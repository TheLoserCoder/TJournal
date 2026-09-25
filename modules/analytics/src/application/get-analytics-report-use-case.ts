import Decimal from 'decimal.js';

import type {
  AnalyticsFactQuery,
  AnalyticsFactSource,
  AnalyticsTradeFact,
} from '../contracts/analytics-fact-source';
import { AnalyticsAccumulator } from '../domain/analytics-accumulator';
import {
  ANALYTICS_BREAKDOWN_DIMENSIONS,
  ANALYTICS_BREAKDOWN_METRICS,
  MAX_ANALYTICS_BREAKDOWN_ROWS,
  MAX_ANALYTICS_FILTER_VALUES,
  UNASSIGNED_ACCOUNT_ID,
  type AnalyticsBreakdownDimension,
  type AnalyticsBreakdownMetric,
  type AnalyticsBreakdownRow,
  type AnalyticsReport,
  type AnalyticsReportQuery,
} from '../domain/analytics-report';
import {
  AnalyticsTimelineAccumulator,
  selectEffectiveGrain,
} from '../domain/analytics-time-buckets';

interface GroupedResult {
  readonly best: AnalyticsBreakdownRow | null;
  readonly groupCount: number;
  readonly rows: readonly AnalyticsBreakdownRow[];
  readonly worst: AnalyticsBreakdownRow | null;
}

export class GetAnalyticsReportUseCase {
  public constructor(private readonly facts: AnalyticsFactSource) {}

  public execute(query: AnalyticsReportQuery): AnalyticsReport {
    validateQuery(query);
    const factQuery: AnalyticsFactQuery = { filters: query.filters, range: query.range };
    const overall = new AnalyticsAccumulator(query.neutralRange);
    const timeline = new AnalyticsTimelineAccumulator(
      selectEffectiveGrain(query.timeGrain, query.range),
      query.range,
    );
    for (const fact of this.facts.scanChronologically(factQuery)) {
      overall.add(fact);
      timeline.add(fact);
    }
    const selected = this.group(
      factQuery,
      query.breakdown.dimension,
      query.breakdown.metric,
      query.breakdown.limit,
      query.neutralRange,
    );
    const instruments =
      query.breakdown.dimension === ANALYTICS_BREAKDOWN_DIMENSIONS.instrument
        ? selected
        : this.group(
            factQuery,
            ANALYTICS_BREAKDOWN_DIMENSIONS.instrument,
            ANALYTICS_BREAKDOWN_METRICS.netResult,
            1,
            query.neutralRange,
          );
    const coverage = overall.coverage;
    return {
      breakdown: {
        dimension: query.breakdown.dimension,
        metric: query.breakdown.metric,
        omittedGroupCount: Math.max(0, selected.groupCount - selected.rows.length),
        rows: selected.rows,
        totalGroupCount: selected.groupCount,
      },
      coverage: {
        coveredTrades: coverage.coveredTrades,
        excludedTrades: coverage.totalTrades - coverage.coveredTrades,
        totalTrades: coverage.totalTrades,
      },
      effectiveRange: { ...query.range, grain: timeline.effectiveGrain },
      highlights: { bestInstrument: instruments.best, worstInstrument: instruments.worst },
      kpis: overall.toKpis(),
      series: timeline.toSeries(),
    };
  }

  private group(
    query: AnalyticsFactQuery,
    dimension: AnalyticsBreakdownDimension,
    metric: AnalyticsBreakdownMetric,
    limit: number,
    neutralRange: AnalyticsReportQuery['neutralRange'],
  ): GroupedResult {
    let currentId: string | null = null;
    let currentLabel = '';
    let accumulator = new AnalyticsAccumulator(neutralRange);
    let best: AnalyticsBreakdownRow | null = null;
    let worst: AnalyticsBreakdownRow | null = null;
    let groupCount = 0;
    const rows: AnalyticsBreakdownRow[] = [];
    const completeGroup = (): void => {
      if (currentId === null) return;
      const row = accumulator.toBreakdownRow(currentId, currentLabel);
      groupCount += 1;
      if (row.coveredTrades > 0) {
        best = chooseBest(best, row);
        worst = chooseWorst(worst, row);
      }
      rows.push(row);
      rows.sort((left, right) => compareRows(left, right, metric));
      if (rows.length > limit) rows.pop();
    };
    for (const fact of this.facts.scanByDimension(query, dimension)) {
      const identity = groupIdentity(fact, dimension);
      if (currentId !== null && identity.id !== currentId) {
        completeGroup();
        accumulator = new AnalyticsAccumulator(neutralRange);
      }
      currentId = identity.id;
      currentLabel = identity.label;
      accumulator.add(fact);
    }
    completeGroup();
    return { best, groupCount, rows, worst };
  }
}

const validateQuery = (query: AnalyticsReportQuery): void => {
  if (query.breakdown.limit < 1 || query.breakdown.limit > MAX_ANALYTICS_BREAKDOWN_ROWS)
    throw new RangeError('Analytics breakdown limit is invalid.');
  const filterLengths = [
    query.filters.accountIds.length,
    query.filters.categories.length,
    query.filters.directions.length,
    query.filters.instrumentIds.length,
  ];
  if (filterLengths.some((length) => length > MAX_ANALYTICS_FILTER_VALUES))
    throw new RangeError('Analytics filter exceeds the maximum value count.');
  const { fromInclusive, toExclusive } = query.range;
  if ((fromInclusive === null) !== (toExclusive === null))
    throw new RangeError('Analytics range must have both boundaries or neither.');
  if (
    fromInclusive !== null &&
    toExclusive !== null &&
    new Date(fromInclusive).getTime() >= new Date(toExclusive).getTime()
  )
    throw new RangeError('Analytics range is reversed or empty.');
};

const groupIdentity = (
  fact: AnalyticsTradeFact,
  dimension: AnalyticsBreakdownDimension,
): { readonly id: string; readonly label: string } => {
  if (dimension === ANALYTICS_BREAKDOWN_DIMENSIONS.account)
    return {
      id: fact.accountId ?? UNASSIGNED_ACCOUNT_ID,
      label: fact.accountLabel ?? UNASSIGNED_ACCOUNT_ID,
    };
  if (dimension === ANALYTICS_BREAKDOWN_DIMENSIONS.category)
    return { id: fact.instrumentCategory, label: fact.instrumentCategory };
  return { id: fact.instrumentId, label: fact.instrumentLabel };
};

const compareRows = (
  left: AnalyticsBreakdownRow,
  right: AnalyticsBreakdownRow,
  metric: AnalyticsBreakdownMetric,
): number => {
  const comparison =
    metric === ANALYTICS_BREAKDOWN_METRICS.netResult
      ? compareCoveredMoneyRows(left, right)
      : metric === ANALYTICS_BREAKDOWN_METRICS.tradeCount
        ? right.totalTrades - left.totalTrades
        : left.winRatePercent === null
          ? right.winRatePercent === null
            ? 0
            : 1
          : right.winRatePercent === null
            ? -1
            : new Decimal(right.winRatePercent).comparedTo(left.winRatePercent);
  return comparison || left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
};

const compareCoveredMoneyRows = (
  left: AnalyticsBreakdownRow,
  right: AnalyticsBreakdownRow,
): number => {
  if (left.coveredTrades === 0) return right.coveredTrades === 0 ? 0 : 1;
  if (right.coveredTrades === 0) return -1;
  return new Decimal(right.netResultUsd).comparedTo(left.netResultUsd);
};

const compareIdentity = (left: AnalyticsBreakdownRow, right: AnalyticsBreakdownRow): number =>
  left.label.localeCompare(right.label) || left.id.localeCompare(right.id);

const chooseBest = (
  current: AnalyticsBreakdownRow | null,
  candidate: AnalyticsBreakdownRow,
): AnalyticsBreakdownRow => {
  if (current === null) return candidate;
  const result = new Decimal(candidate.netResultUsd).comparedTo(current.netResultUsd);
  return result > 0 || (result === 0 && compareIdentity(candidate, current) < 0)
    ? candidate
    : current;
};

const chooseWorst = (
  current: AnalyticsBreakdownRow | null,
  candidate: AnalyticsBreakdownRow,
): AnalyticsBreakdownRow => {
  if (current === null) return candidate;
  const result = new Decimal(candidate.netResultUsd).comparedTo(current.netResultUsd);
  return result < 0 || (result === 0 && compareIdentity(candidate, current) < 0)
    ? candidate
    : current;
};
