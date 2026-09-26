import { describe, expect, it } from 'vitest';

import type {
  AnalyticsFactQuery,
  AnalyticsFactSource,
  AnalyticsTradeFact,
} from '../contracts/analytics-fact-source';
import {
  ANALYTICS_BREAKDOWN_DIMENSIONS,
  ANALYTICS_BREAKDOWN_METRICS,
  type AnalyticsBreakdownDimension,
  type AnalyticsReportQuery,
} from '../domain/analytics-report';
import { GetAnalyticsReportUseCase } from './get-analytics-report-use-case';

const fact = (
  id: string,
  closedAt: string,
  netResultUsd: string | null,
  instrumentId = 'eurusd',
): AnalyticsTradeFact => ({
  accountId: 'primary',
  accountLabel: 'Primary',
  closedAt,
  direction: 'long',
  id,
  instrumentCategory: 'forex',
  instrumentId,
  instrumentLabel: instrumentId.toUpperCase(),
  netResultUsd,
});

class InMemoryFactSource implements AnalyticsFactSource {
  public chronologicalScanCount = 0;

  public constructor(private readonly facts: readonly AnalyticsTradeFact[]) {}

  public scanByDimension(
    _query: AnalyticsFactQuery,
    dimension: AnalyticsBreakdownDimension,
  ): Iterable<AnalyticsTradeFact> {
    const key = (item: AnalyticsTradeFact): string => {
      if (dimension === ANALYTICS_BREAKDOWN_DIMENSIONS.account) return item.accountId ?? '';
      if (dimension === ANALYTICS_BREAKDOWN_DIMENSIONS.category) return item.instrumentCategory;
      return item.instrumentId;
    };
    return [...this.facts].sort(
      (left, right) =>
        key(left).localeCompare(key(right)) ||
        left.closedAt.localeCompare(right.closedAt) ||
        left.id.localeCompare(right.id),
    );
  }

  public scanChronologically(): Iterable<AnalyticsTradeFact> {
    this.chronologicalScanCount += 1;
    return [...this.facts].sort(
      (left, right) =>
        left.closedAt.localeCompare(right.closedAt) || left.id.localeCompare(right.id),
    );
  }
}

const query = (): AnalyticsReportQuery => ({
  breakdown: {
    dimension: ANALYTICS_BREAKDOWN_DIMENSIONS.instrument,
    limit: 10,
    metric: ANALYTICS_BREAKDOWN_METRICS.netResult,
  },
  filters: {
    accountIds: [],
    categories: [],
    directions: [],
    includeUnassigned: true,
    instrumentIds: [],
  },
  neutralRange: null,
  range: { fromInclusive: null, toExclusive: null },
  timeGrain: 'day',
});

describe('GetAnalyticsReportUseCase', () => {
  it('uses exact decimals, excludes neutral trades from win rate and exposes legacy coverage', () => {
    const source = new InMemoryFactSource([
      fact('1', '2026-09-01T10:00:00.000Z', '0.1'),
      fact('2', '2026-09-01T11:00:00.000Z', '0.2'),
      fact('3', '2026-09-01T12:00:00.000Z', '0'),
      fact('4', '2026-09-01T13:00:00.000Z', null),
    ]);

    const report = new GetAnalyticsReportUseCase(source).execute(query());

    expect(report.kpis.netResultUsd).toBe('0.3');
    expect(report.kpis.winRatePercent).toBe('100');
    expect(report.kpis.profitFactor).toBeNull();
    expect(report.coverage).toEqual({ coveredTrades: 3, excludedTrades: 1, totalTrades: 4 });
  });

  it('calculates peak-to-trough drawdown from a zero starting peak', () => {
    const source = new InMemoryFactSource([
      fact('1', '2026-09-01T10:00:00.000Z', '-5'),
      fact('2', '2026-09-02T10:00:00.000Z', '10'),
      fact('3', '2026-09-03T10:00:00.000Z', '-7'),
    ]);

    const report = new GetAnalyticsReportUseCase(source).execute(query());

    expect(report.kpis.maxDrawdownUsd).toBe('7');
    expect(report.series.map((point) => point.drawdownUsd)).toEqual(['5', '0', '7']);
  });

  it('selects mathematical best and worst instruments with deterministic ordering', () => {
    const source = new InMemoryFactSource([
      fact('1', '2026-09-01T10:00:00.000Z', '5', 'btc'),
      fact('2', '2026-09-02T10:00:00.000Z', '2', 'eurusd'),
      fact('3', '2026-09-03T10:00:00.000Z', '1', 'eurusd'),
    ]);

    const report = new GetAnalyticsReportUseCase(source).execute(query());

    expect(report.highlights.bestInstrument?.id).toBe('btc');
    expect(report.highlights.worstInstrument?.id).toBe('eurusd');
    expect(report.breakdown.rows.map((row) => row.id)).toEqual(['btc', 'eurusd']);
  });

  it('coarsens a long series while reading chronological facts once', () => {
    const source = new InMemoryFactSource(
      Array.from({ length: 401 }, (_, index) =>
        fact(String(index), new Date(Date.UTC(2024, 0, index + 1, 12)).toISOString(), '1'),
      ),
    );

    const report = new GetAnalyticsReportUseCase(source).execute(query());

    expect(source.chronologicalScanCount).toBe(1);
    expect(report.effectiveRange.grain).toBe('week');
    expect(report.series.length).toBeLessThanOrEqual(400);
    expect(report.kpis.netResultUsd).toBe('401');
  });

  it('excludes uncovered instruments and never reports one covered instrument as both best and worst', () => {
    const source = new InMemoryFactSource([
      fact('1', '2026-09-01T10:00:00.000Z', null, 'uncovered'),
      fact('2', '2026-09-02T10:00:00.000Z', '-1', 'covered'),
    ]);

    const report = new GetAnalyticsReportUseCase(source).execute(query());

    // A single negative group is the worst, not simultaneously the best.
    expect(report.highlights.bestInstrument).toBeNull();
    expect(report.highlights.worstInstrument?.id).toBe('covered');
    expect(report.breakdown.rows.map((row) => row.id)).toEqual(['covered', 'uncovered']);
  });

  it('reports a single positive instrument only as the best', () => {
    const source = new InMemoryFactSource([fact('1', '2026-09-01T10:00:00.000Z', '4', 'solo')]);

    const report = new GetAnalyticsReportUseCase(source).execute(query());

    expect(report.highlights.bestInstrument?.id).toBe('solo');
    expect(report.highlights.worstInstrument).toBeNull();
  });

  it('drops both highlights when a single covered instrument is neutral', () => {
    const source = new InMemoryFactSource([fact('1', '2026-09-01T10:00:00.000Z', '0', 'flat')]);

    const report = new GetAnalyticsReportUseCase(source).execute(query());

    expect(report.highlights.bestInstrument).toBeNull();
    expect(report.highlights.worstInstrument).toBeNull();
  });

  it('keeps a continuous hourly axis for a bounded day', () => {
    const source = new InMemoryFactSource([fact('1', '2026-09-20T09:05:00.000Z', '2')]);

    const report = new GetAnalyticsReportUseCase(source).execute({
      ...query(),
      range: {
        fromInclusive: '2026-09-20T00:00:00.000Z',
        toExclusive: '2026-09-21T00:00:00.000Z',
      },
      timeGrain: 'auto',
    });

    expect(report.effectiveRange.grain).toBe('hour');
    expect(report.series).toHaveLength(24);
    expect(report.series.filter((point) => point.coveredTrades > 0)).toHaveLength(1);
    expect(report.kpis.netResultUsd).toBe('2');
  });
});
