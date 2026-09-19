import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { JournalPresenter } from './use-journal-presenter';
import { useTradeSummaryPresenter } from './use-trade-summary-presenter';

const summary = (totalResult: string) => ({
  bestInstrument: 'EURUSD',
  coveredTrades: 1,
  losingTrades: 0,
  neutralTrades: 0,
  totalResult,
  totalTrades: 1,
  winRate: '100',
  winningTrades: 1,
  worstInstrument: null,
});

const deferred = <T>() => {
  let resolvePromise: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
};

describe('useTradeSummaryPresenter', () => {
  it('does not let an older request overwrite a newer filter result', async () => {
    const first = deferred<ReturnType<typeof summary>>();
    const getTradeSummary = vi
      .fn()
      .mockImplementation(() =>
        getTradeSummary.mock.calls.length === 1 ? first.promise : Promise.resolve(summary('20')),
      );
    const journal = {
      getTradeSummary,
      instruments: [],
      settings: {
        languageMode: 'en' as const,
        tableLayouts: [],
        themeMode: 'light' as const,
        tradeSummary: { followTableFilters: true, metric: 'cash' as const, period: 'all' as const },
      },
      tradePreferences: {
        neutralCostSettings: { includeCommission: false, includeSpread: false },
        neutralRanges: { cash: null, percent: null, r: null },
        riskBinding: null,
        riskPromptDismissed: false,
      },
      trades: [],
      updateSettings: vi.fn(),
    } as unknown as JournalPresenter;
    const emptyAssetFilters: readonly string[] = [];

    const { result, rerender } = renderHook(
      ({ dateFrom }: { dateFrom: string }) =>
        useTradeSummaryPresenter(journal, {
          assetFilterIds: emptyAssetFilters,
          dateFrom,
          dateTo: '',
          resultFilter: 'all',
        }),
      { initialProps: { dateFrom: '' } },
    );

    await act(async () => {
      rerender({ dateFrom: '2026-09-01' });
      first.resolve(summary('10'));
      await Promise.resolve();
    });

    expect(result.current.summary?.totalResult).toBe('20');
  });
});
