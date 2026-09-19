import { useEffect, useState } from 'react';
import Decimal from 'decimal.js';

import type {
  SummaryPeriod,
  TradeResultKind,
  TradeSummaryDto,
  TradeSummaryFilterDto,
} from '../../../shared/desktop-api';
import type { JournalPresenter } from './use-journal-presenter';

export interface TradeSummaryFilterState {
  readonly accountFilterIds?: readonly string[];
  readonly includeUnassigned?: boolean;
  readonly assetFilterIds: readonly string[];
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly resultFilter: 'all' | TradeResultKind;
}

export interface TradeSummaryPresenter {
  readonly metric: TradeResultKind;
  readonly period: SummaryPeriod;
  readonly followTableFilters: boolean;
  readonly summary: TradeSummaryDto | null;
  readonly summaryRefreshing: boolean;
  readonly settingsOpen: boolean;
  closeSettings(): void;
  openSettings(): void;
  setMetric(value: TradeResultKind): void;
  setPeriod(value: SummaryPeriod): void;
  setFollowTableFilters(value: boolean): void;
}

const EMPTY_ACCOUNT_FILTER_IDS: readonly string[] = [];

const toFilter = (state: TradeSummaryFilterState): TradeSummaryFilterDto => ({
  closedFrom: state.dateFrom === '' ? null : `${state.dateFrom}T00:00:00.000Z`,
  closedTo: state.dateTo === '' ? null : `${state.dateTo}T23:59:59.999Z`,
  instrumentIds: state.assetFilterIds.length === 0 ? null : [...state.assetFilterIds].sort(),
  resultKinds: state.resultFilter === 'all' ? null : [state.resultFilter],
  accountIds:
    (state.accountFilterIds ?? []).length === 0 && !state.includeUnassigned
      ? null
      : [...(state.accountFilterIds ?? [])].sort(),
  includeUnassigned: state.includeUnassigned ?? false,
});

export const useTradeSummaryPresenter = (
  journal: JournalPresenter,
  filterState: TradeSummaryFilterState,
): TradeSummaryPresenter => {
  const preferences = journal.settings.tradeSummary;
  const getTradeSummary = journal.getTradeSummary;
  const { assetFilterIds, dateFrom, dateTo, resultFilter } = filterState;
  const accountFilterIds = filterState.accountFilterIds ?? EMPTY_ACCOUNT_FILTER_IDS;
  const includeUnassigned = filterState.includeUnassigned ?? false;
  const [summary, setSummary] = useState<TradeSummaryDto | null>(null);
  const [summaryRefreshing, setSummaryRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setSummaryRefreshing(true);
    const request = {
      filters: preferences.followTableFilters
        ? toFilter({
            accountFilterIds,
            assetFilterIds,
            dateFrom,
            dateTo,
            includeUnassigned,
            resultFilter,
          })
        : null,
      metric: preferences.metric,
      period: preferences.period,
    };
    void getTradeSummary(request).then((nextSummary) => {
      if (!active) return;
      if (nextSummary !== null) {
        const accountIds =
          preferences.followTableFilters && accountFilterIds.length > 0
            ? new Set(accountFilterIds)
            : null;
        const visibleAccounts = (journal.accounts ?? []).filter(
          (account) =>
            account.archivedAt === null && (accountIds === null || accountIds.has(account.id)),
        );
        const accountedBalanceIncomplete = visibleAccounts.some(
          (account) => account.uncoveredTradeCount > 0,
        );
        const accountedBalanceUsd = accountedBalanceIncomplete
          ? undefined
          : visibleAccounts
              .reduce((sum, account) => sum.plus(account.currentKnownBalanceUsd), new Decimal(0))
              .toFixed();
        setSummary({ ...nextSummary, accountedBalanceUsd });
      }
      setSummaryRefreshing(false);
    });
    return () => {
      active = false;
    };
  }, [
    assetFilterIds,
    accountFilterIds,
    dateFrom,
    dateTo,
    resultFilter,
    includeUnassigned,
    getTradeSummary,
    journal.dataVersion,
    preferences.followTableFilters,
    preferences.metric,
    preferences.period,
    journal.accounts,
  ]);

  const update = (next: typeof preferences): void => {
    void journal.updateSettings({ ...journal.settings, tradeSummary: next });
  };

  return {
    metric: preferences.metric,
    period: preferences.period,
    followTableFilters: preferences.followTableFilters,
    settingsOpen,
    summaryRefreshing,
    closeSettings: () => setSettingsOpen(false),
    openSettings: () => setSettingsOpen(true),
    setMetric: (value) => update({ ...preferences, metric: value }),
    setPeriod: (value) => update({ ...preferences, period: value }),
    setFollowTableFilters: (value) => update({ ...preferences, followTableFilters: value }),
    summary,
  };
};
