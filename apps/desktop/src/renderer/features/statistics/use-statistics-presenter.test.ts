import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_APPLICATION_SETTINGS } from '../../../shared/application-settings';
import type { AnalyticsReportDto } from '../../../shared/desktop-api';
import { resolveStatisticsRange, useStatisticsPresenter } from './use-statistics-presenter';

const NOW = new Date('2026-09-20T18:00:00.000Z');
const EMPTY_REPORT: AnalyticsReportDto = {
  breakdown: {
    dimension: 'instrument',
    metric: 'net-result',
    omittedGroupCount: 0,
    rows: [],
    totalGroupCount: 0,
  },
  coverage: { coveredTrades: 0, excludedTrades: 0, totalTrades: 0 },
  effectiveRange: { fromInclusive: null, grain: 'month', toExclusive: null },
  highlights: { bestInstrument: null, worstInstrument: null },
  kpis: {
    averageTradeUsd: null,
    grossLossMagnitudeUsd: null,
    grossProfitUsd: null,
    losingTrades: 0,
    maxDrawdownUsd: null,
    netResultUsd: null,
    neutralTrades: 0,
    profitFactor: null,
    winRatePercent: null,
    winningTrades: 0,
  },
  series: [],
};

describe('resolveStatisticsRange', () => {
  it('uses UTC calendar boundaries for current periods', () => {
    expect(resolveStatisticsRange('current-day', { from: '', to: '' }, NOW)).toEqual({
      fromInclusive: '2026-09-20T00:00:00.000Z',
      toExclusive: '2026-09-21T00:00:00.000Z',
    });
    expect(resolveStatisticsRange('current-week', { from: '', to: '' }, NOW)).toEqual({
      fromInclusive: '2026-09-14T00:00:00.000Z',
      toExclusive: '2026-09-21T00:00:00.000Z',
    });
    expect(resolveStatisticsRange('current-month', { from: '', to: '' }, NOW)).toEqual({
      fromInclusive: '2026-09-01T00:00:00.000Z',
      toExclusive: '2026-09-21T00:00:00.000Z',
    });
    expect(resolveStatisticsRange('current-year', { from: '', to: '' }, NOW)).toEqual({
      fromInclusive: '2026-01-01T00:00:00.000Z',
      toExclusive: '2026-09-21T00:00:00.000Z',
    });
  });

  it('converts inclusive custom dates to a half-open UTC interval', () => {
    expect(resolveStatisticsRange('custom', { from: '2026-09-01', to: '2026-09-20' }, NOW)).toEqual(
      {
        fromInclusive: '2026-09-01T00:00:00.000Z',
        toExclusive: '2026-09-21T00:00:00.000Z',
      },
    );
  });
});

describe('useStatisticsPresenter', () => {
  it('ignores a report that resolves after the presenter is disabled', async () => {
    let resolveReport: ((report: AnalyticsReportDto | null) => void) | undefined;
    const getReport = vi.fn(
      () =>
        new Promise<AnalyticsReportDto | null>((resolve) => {
          resolveReport = resolve;
        }),
    );
    const { rerender, result } = renderHook(
      ({ enabled }: { readonly enabled: boolean }) =>
        useStatisticsPresenter({
          dataVersion: 0,
          enabled,
          getReport,
          settings: DEFAULT_APPLICATION_SETTINGS,
          updateSettings: vi.fn().mockResolvedValue(undefined),
        }),
      { initialProps: { enabled: true } },
    );

    rerender({ enabled: false });
    await act(async () => resolveReport?.(EMPTY_REPORT));

    expect(result.current.report).toBeNull();
    expect(result.current.refreshing).toBe(false);
  });

  it('reports active filters only after a filter or period changes', async () => {
    const getReport = vi.fn().mockResolvedValue(EMPTY_REPORT);
    const { result } = renderHook(() =>
      useStatisticsPresenter({
        dataVersion: 0,
        enabled: true,
        getReport,
        settings: DEFAULT_APPLICATION_SETTINGS,
        updateSettings: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(result.current.hasActiveFilters).toBe(false);
    await act(async () => result.current.setAccountIds(['primary']));
    expect(result.current.hasActiveFilters).toBe(true);
    await act(async () => result.current.resetFilters());
    expect(result.current.hasActiveFilters).toBe(false);
    await act(async () => result.current.setPeriod('current-day'));
    expect(result.current.hasActiveFilters).toBe(true);
  });
});
