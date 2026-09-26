import { useEffect, useState } from 'react';
import Decimal from 'decimal.js';

import type {
  SummaryPeriod,
  TradeResultKind,
  TradeSummaryDto,
  TradeSummaryFilterDto,
} from '../../../shared/desktop-api';
import type { DateTimeRangeFilterState } from '../../components/ui/datetime-range-filter-state';
import type { NumberFilterState } from '../../components/ui/number-filter-state';
import type { TradeEntryFilter } from './trade-table-filters';
import type { JournalPresenter } from './use-journal-presenter';

export interface TradeSummaryFilterState {
  readonly accountFilterIds?: readonly string[];
  readonly assetFilterIds: readonly string[];
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly dateTimeRange?: DateTimeRangeFilterState;
  readonly entryFilters?: readonly TradeEntryFilter[];
  readonly includeUnassigned?: boolean;
  readonly resultBounds?: NumberFilterState;
  readonly resultUnit?: TradeResultKind | 'all';
  readonly textQuery?: string;
}

export interface TradeSummaryPresenter {
  readonly period: SummaryPeriod;
  readonly followTableFilters: boolean;
  readonly summary: TradeSummaryDto | null;
  readonly summaryRefreshing: boolean;
  readonly settingsOpen: boolean;
  closeSettings(): void;
  openSettings(): void;
  setPeriod(value: SummaryPeriod): void;
  setFollowTableFilters(value: boolean): void;
}

const EMPTY_ACCOUNT_FILTER_IDS: readonly string[] = [];
const EMPTY_ENTRY_FILTERS: readonly TradeEntryFilter[] = [];
/** The quick summary is always expressed in the authoritative USD result. */
const TRADE_SUMMARY_METRIC: TradeResultKind = 'cash';

const toFilter = (state: TradeSummaryFilterState): TradeSummaryFilterDto => {
  const resultBounds = state.resultBounds;
  const rawMinimum = resultBounds?.minimum.trim().replace(',', '.') ?? '';
  const rawMaximum = resultBounds?.maximum.trim().replace(',', '.') ?? '';
  // The equals mode edits a single value; mirror it into both bounds so the
  // analytics exact-match branch triggers.
  const minimum = rawMinimum;
  const maximum = resultBounds?.mode === 'equals' ? rawMinimum : rawMaximum;
  const range = state.dateTimeRange;
  const hasDateTimeRange = range !== undefined && (range.from !== '' || range.to !== '');
  const closedFrom = hasDateTimeRange
    ? range.from === ''
      ? null
      : new Date(
          `${range.from}T${range.fromTime === '' ? '00:00' : range.fromTime}:00`,
        ).toISOString()
    : state.dateFrom === ''
      ? null
      : `${state.dateFrom}T00:00:00.000Z`;
  const closedTo = hasDateTimeRange
    ? range.to === ''
      ? null
      : new Date(`${range.to}T${range.toTime === '' ? '23:59' : range.toTime}:00`).toISOString()
    : state.dateTo === ''
      ? null
      : `${state.dateTo}T23:59:59.999Z`;
  const entryFilters = state.entryFilters ?? [];
  return {
    closedFrom,
    closedTo,
    entryKinds:
      entryFilters.length === 0
        ? null
        : [
            ...new Set(
              entryFilters.map((filter) =>
                filter === 'long' || filter === 'short' ? 'trade' : filter,
              ),
            ),
          ],
    instrumentIds: state.assetFilterIds.length === 0 ? null : [...state.assetFilterIds].sort(),
    netResultBounds:
      minimum === '' && maximum === ''
        ? null
        : {
            maximum: maximum === '' ? null : maximum,
            minimum: minimum === '' ? null : minimum,
          },
    resultKinds: null,
    resultUnits:
      state.resultUnit === undefined || state.resultUnit === 'all' ? null : [state.resultUnit],
    accountIds:
      (state.accountFilterIds ?? []).length === 0 && !state.includeUnassigned
        ? null
        : [...(state.accountFilterIds ?? [])].sort(),
    includeUnassigned: state.includeUnassigned ?? false,
    textQuery:
      state.textQuery === undefined || state.textQuery.trim() === ''
        ? null
        : state.textQuery.trim(),
  };
};

export const useTradeSummaryPresenter = (
  journal: JournalPresenter,
  filterState: TradeSummaryFilterState,
  enabled = true,
): TradeSummaryPresenter => {
  const preferences = journal.settings.tradeSummary;
  const getTradeSummary = journal.getTradeSummary;
  const { assetFilterIds, dateFrom, dateTo } = filterState;
  const accountFilterIds = filterState.accountFilterIds ?? EMPTY_ACCOUNT_FILTER_IDS;
  const entryFilters = filterState.entryFilters ?? EMPTY_ENTRY_FILTERS;
  const includeUnassigned = filterState.includeUnassigned ?? false;
  const dateTimeRange = filterState.dateTimeRange;
  const resultBounds = filterState.resultBounds;
  const resultUnit = filterState.resultUnit;
  const textQuery = filterState.textQuery;
  const [summary, setSummary] = useState<TradeSummaryDto | null>(null);
  const [summaryRefreshing, setSummaryRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSummaryRefreshing(false);
      return;
    }
    let active = true;
    setSummaryRefreshing(true);
    const request = {
      filters: preferences.followTableFilters
        ? toFilter({
            accountFilterIds,
            assetFilterIds,
            dateFrom,
            dateTo,
            dateTimeRange,
            entryFilters,
            includeUnassigned,
            resultBounds,
            resultUnit,
            textQuery,
          })
        : null,
      metric: TRADE_SUMMARY_METRIC,
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
    entryFilters,
    dateFrom,
    dateTo,
    dateTimeRange,
    resultBounds,
    resultUnit,
    textQuery,
    includeUnassigned,
    getTradeSummary,
    journal.dataVersion,
    preferences.followTableFilters,
    preferences.period,
    journal.accounts,
    enabled,
  ]);

  const update = (next: typeof preferences): void => {
    void journal.updateSettings({ tradeSummary: next });
  };

  return {
    period: preferences.period,
    followTableFilters: preferences.followTableFilters,
    settingsOpen,
    summaryRefreshing,
    closeSettings: () => setSettingsOpen(false),
    openSettings: () => setSettingsOpen(true),
    setPeriod: (value) => update({ ...preferences, period: value }),
    setFollowTableFilters: (value) => update({ ...preferences, followTableFilters: value }),
    summary,
  };
};
