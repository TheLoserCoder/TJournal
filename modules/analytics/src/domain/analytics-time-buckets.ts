import Decimal from 'decimal.js';

import type { AnalyticsTradeFact } from '../contracts/analytics-fact-source';
import {
  ANALYTICS_TIME_GRAINS,
  MAX_ANALYTICS_SERIES_POINTS,
  type AnalyticsReportRange,
  type AnalyticsSeriesPoint,
  type AnalyticsTimeGrain,
  type EffectiveAnalyticsTimeGrain,
} from './analytics-report';

interface MutableBucket {
  readonly bucketEnd: string;
  readonly bucketStart: string;
  coveredTrades: number;
  netResult: Decimal;
}

const MILLISECONDS_PER_HOUR = 3_600_000;
const MILLISECONDS_PER_DAY = 86_400_000;
const MAX_HOURLY_RANGE_DAYS = 2;
const MAX_DAILY_RANGE_DAYS = 45;
const MAX_WEEKLY_RANGE_DAYS = 400 * 7;

export const selectEffectiveGrain = (
  requested: AnalyticsTimeGrain,
  range: AnalyticsReportRange,
): EffectiveAnalyticsTimeGrain => {
  if (requested !== ANALYTICS_TIME_GRAINS.auto) return requested;
  if (range.fromInclusive === null || range.toExclusive === null)
    return ANALYTICS_TIME_GRAINS.month;
  const days =
    (new Date(range.toExclusive).getTime() - new Date(range.fromInclusive).getTime()) /
    MILLISECONDS_PER_DAY;
  if (days <= MAX_HOURLY_RANGE_DAYS) return ANALYTICS_TIME_GRAINS.hour;
  if (days <= MAX_DAILY_RANGE_DAYS) return ANALYTICS_TIME_GRAINS.day;
  if (days <= MAX_WEEKLY_RANGE_DAYS) return ANALYTICS_TIME_GRAINS.week;
  return ANALYTICS_TIME_GRAINS.month;
};

export class AnalyticsTimelineAccumulator {
  private buckets = new Map<string, MutableBucket>();

  public constructor(
    private grain: EffectiveAnalyticsTimeGrain,
    range?: AnalyticsReportRange,
  ) {
    if (range !== undefined) this.seedRange(range);
  }

  public add(fact: AnalyticsTradeFact): void {
    if (fact.netResultUsd === null) return;
    const boundary = bucketBoundary(fact.closedAt, this.grain);
    const bucket = this.buckets.get(boundary.start) ?? {
      bucketEnd: boundary.end,
      bucketStart: boundary.start,
      coveredTrades: 0,
      netResult: new Decimal(0),
    };
    bucket.coveredTrades += 1;
    bucket.netResult = bucket.netResult.plus(fact.netResultUsd);
    this.buckets.set(boundary.start, bucket);
    while (this.buckets.size > MAX_ANALYTICS_SERIES_POINTS) this.coarsen();
  }

  public get effectiveGrain(): EffectiveAnalyticsTimeGrain {
    return this.grain;
  }

  public toSeries(): readonly AnalyticsSeriesPoint[] {
    let cumulative = new Decimal(0);
    let peak = new Decimal(0);
    return [...this.buckets.values()]
      .sort((left, right) =>
        left.bucketStart < right.bucketStart ? -1 : left.bucketStart > right.bucketStart ? 1 : 0,
      )
      .map((bucket) => {
        cumulative = cumulative.plus(bucket.netResult);
        if (cumulative.greaterThan(peak)) peak = cumulative;
        return {
          bucketEnd: bucket.bucketEnd,
          bucketStart: bucket.bucketStart,
          coveredTrades: bucket.coveredTrades,
          cumulativeNetResultUsd: cumulative.toString(),
          drawdownUsd: peak.minus(cumulative).toString(),
          netResultUsd: bucket.netResult.toString(),
        };
      });
  }

  /**
   * Seeds every bucket of a bounded range so the series is continuous (a day
   * shows all 24 hours even when most have no trades). Unbounded ranges keep
   * only the buckets that contain trades. Seeding is skipped when the range
   * would exceed the point budget, leaving coarsening to the streaming scan.
   */
  private seedRange(range: AnalyticsReportRange): void {
    if (range.fromInclusive === null || range.toExclusive === null) return;
    const end = new Date(range.toExclusive).getTime();
    let cursor = bucketBoundary(range.fromInclusive, this.grain).start;
    const seeded: MutableBucket[] = [];
    while (new Date(cursor).getTime() < end) {
      if (seeded.length >= MAX_ANALYTICS_SERIES_POINTS) return;
      const boundary = bucketBoundary(cursor, this.grain);
      seeded.push({
        bucketEnd: boundary.end,
        bucketStart: boundary.start,
        coveredTrades: 0,
        netResult: new Decimal(0),
      });
      cursor = boundary.end;
    }
    for (const bucket of seeded) this.buckets.set(bucket.bucketStart, bucket);
  }

  private coarsen(): void {
    const nextGrain = coarserGrain(this.grain);
    if (nextGrain === null)
      throw new RangeError('Analytics series exceeds the maximum point count.');
    const coarsened = new Map<string, MutableBucket>();
    for (const existing of this.buckets.values()) {
      const boundary = bucketBoundary(existing.bucketStart, nextGrain);
      const bucket = coarsened.get(boundary.start) ?? {
        bucketEnd: boundary.end,
        bucketStart: boundary.start,
        coveredTrades: 0,
        netResult: new Decimal(0),
      };
      bucket.coveredTrades += existing.coveredTrades;
      bucket.netResult = bucket.netResult.plus(existing.netResult);
      coarsened.set(boundary.start, bucket);
    }
    this.buckets = coarsened;
    this.grain = nextGrain;
  }
}

const coarserGrain = (grain: EffectiveAnalyticsTimeGrain): EffectiveAnalyticsTimeGrain | null => {
  if (grain === ANALYTICS_TIME_GRAINS.hour) return ANALYTICS_TIME_GRAINS.day;
  if (grain === ANALYTICS_TIME_GRAINS.day) return ANALYTICS_TIME_GRAINS.week;
  if (grain === ANALYTICS_TIME_GRAINS.week) return ANALYTICS_TIME_GRAINS.month;
  if (grain === ANALYTICS_TIME_GRAINS.month) return 'year';
  return null;
};

const bucketBoundary = (
  isoValue: string,
  grain: EffectiveAnalyticsTimeGrain,
): { readonly end: string; readonly start: string } => {
  const start = new Date(isoValue);
  start.setUTCMinutes(0, 0, 0);
  if (grain === ANALYTICS_TIME_GRAINS.hour) {
    const end = new Date(start.getTime() + MILLISECONDS_PER_HOUR);
    return { end: end.toISOString(), start: start.toISOString() };
  }
  start.setUTCHours(0, 0, 0, 0);
  if (grain === ANALYTICS_TIME_GRAINS.week) {
    const mondayOffset = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - mondayOffset);
  } else if (grain === ANALYTICS_TIME_GRAINS.month) {
    start.setUTCDate(1);
  } else if (grain === 'year') {
    start.setUTCMonth(0, 1);
  }
  const end = new Date(start);
  if (grain === ANALYTICS_TIME_GRAINS.day) end.setUTCDate(end.getUTCDate() + 1);
  else if (grain === ANALYTICS_TIME_GRAINS.week) end.setUTCDate(end.getUTCDate() + 7);
  else if (grain === ANALYTICS_TIME_GRAINS.month) end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCFullYear(end.getUTCFullYear() + 1);
  return { end: end.toISOString(), start: start.toISOString() };
};
