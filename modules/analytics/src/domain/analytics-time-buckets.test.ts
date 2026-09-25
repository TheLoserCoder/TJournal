import { describe, expect, it } from 'vitest';

import type { AnalyticsTradeFact } from '../contracts/analytics-fact-source';
import { ANALYTICS_TIME_GRAINS } from './analytics-report';
import { AnalyticsTimelineAccumulator, selectEffectiveGrain } from './analytics-time-buckets';

const fact = (id: string, closedAt: string, netResultUsd: string): AnalyticsTradeFact => ({
  accountId: 'primary',
  accountLabel: 'Primary',
  closedAt,
  direction: 'long',
  id,
  instrumentCategory: 'forex',
  instrumentId: 'eurusd',
  instrumentLabel: 'EURUSD',
  netResultUsd,
});

describe('selectEffectiveGrain', () => {
  it('uses hourly buckets for a single-day range', () => {
    expect(
      selectEffectiveGrain(ANALYTICS_TIME_GRAINS.auto, {
        fromInclusive: '2026-09-20T00:00:00.000Z',
        toExclusive: '2026-09-21T00:00:00.000Z',
      }),
    ).toBe(ANALYTICS_TIME_GRAINS.hour);
  });

  it('keeps daily buckets for a multi-day range', () => {
    expect(
      selectEffectiveGrain(ANALYTICS_TIME_GRAINS.auto, {
        fromInclusive: '2026-09-01T00:00:00.000Z',
        toExclusive: '2026-09-21T00:00:00.000Z',
      }),
    ).toBe(ANALYTICS_TIME_GRAINS.day);
  });

  it('returns an explicit request unchanged and falls back to monthly for an unbounded range', () => {
    expect(
      selectEffectiveGrain(ANALYTICS_TIME_GRAINS.month, {
        fromInclusive: '2026-09-20T00:00:00.000Z',
        toExclusive: '2026-09-21T00:00:00.000Z',
      }),
    ).toBe(ANALYTICS_TIME_GRAINS.month);
    expect(
      selectEffectiveGrain(ANALYTICS_TIME_GRAINS.auto, {
        fromInclusive: null,
        toExclusive: null,
      }),
    ).toBe(ANALYTICS_TIME_GRAINS.month);
  });
});

describe('AnalyticsTimelineAccumulator', () => {
  it('groups trades into UTC hour buckets', () => {
    const accumulator = new AnalyticsTimelineAccumulator(ANALYTICS_TIME_GRAINS.hour);
    accumulator.add(fact('1', '2026-09-20T09:05:00.000Z', '1'));
    accumulator.add(fact('2', '2026-09-20T09:59:59.000Z', '2'));
    accumulator.add(fact('3', '2026-09-20T10:30:00.000Z', '-1'));

    const series = accumulator.toSeries();

    expect(series.map((point) => point.bucketStart)).toEqual([
      '2026-09-20T09:00:00.000Z',
      '2026-09-20T10:00:00.000Z',
    ]);
    expect(series[0]?.coveredTrades).toBe(2);
    expect(series[0]?.netResultUsd).toBe('3');
    expect(series[1]?.netResultUsd).toBe('-1');
  });

  it('seeds every hour of a bounded day so empty hours stay visible', () => {
    const accumulator = new AnalyticsTimelineAccumulator(ANALYTICS_TIME_GRAINS.hour, {
      fromInclusive: '2026-09-20T00:00:00.000Z',
      toExclusive: '2026-09-21T00:00:00.000Z',
    });
    accumulator.add(fact('1', '2026-09-20T09:05:00.000Z', '2'));
    accumulator.add(fact('2', '2026-09-20T09:59:59.000Z', '3'));

    const series = accumulator.toSeries();

    expect(series).toHaveLength(24);
    expect(series[0]?.bucketStart).toBe('2026-09-20T00:00:00.000Z');
    expect(series[23]?.bucketStart).toBe('2026-09-20T23:00:00.000Z');
    expect(series[9]?.coveredTrades).toBe(2);
    expect(series[9]?.netResultUsd).toBe('5');
    expect(series[0]?.coveredTrades).toBe(0);
    expect(series[0]?.cumulativeNetResultUsd).toBe('0');
    expect(series[10]?.cumulativeNetResultUsd).toBe('5');
  });

  it('does not seed a range that would exceed the point budget', () => {
    const accumulator = new AnalyticsTimelineAccumulator(ANALYTICS_TIME_GRAINS.hour, {
      fromInclusive: '2026-01-01T00:00:00.000Z',
      toExclusive: '2026-02-01T00:00:00.000Z',
    });

    expect(accumulator.toSeries()).toHaveLength(0);
  });

  it('coarsens hourly buckets to days before exceeding the point cap', () => {
    const accumulator = new AnalyticsTimelineAccumulator(ANALYTICS_TIME_GRAINS.hour);
    for (let hour = 0; hour < 500; hour += 1) {
      accumulator.add(fact(String(hour), new Date(Date.UTC(2026, 0, 1, hour)).toISOString(), '1'));
    }

    expect(accumulator.effectiveGrain).toBe(ANALYTICS_TIME_GRAINS.day);
    expect(accumulator.toSeries().length).toBeLessThanOrEqual(400);
  });
});
