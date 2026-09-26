import type { SortingState } from '@tanstack/react-table';

import type {
  JournalPageBoundMode,
  JournalPageFiltersDto,
  JournalPageRequestDto,
  JournalPageResultBoundsDto,
  JournalPageSortField,
} from '../../../shared/desktop-api';
import {
  isDateTimeRangeFilterStateDefault,
  type DateTimeRangeFilterState,
} from '../../components/ui/datetime-range-filter-state';
import {
  isNumberFilterStateDefault,
  NUMBER_FILTER_MODES,
  type NumberFilterMode,
  type NumberFilterState,
} from '../../components/ui/number-filter-state';
import {
  TRADE_RESULT_FILTERS,
  TRADE_TABLE_SORT_FIELDS,
  type TradeDetailNumericField,
} from './trade-table.config';
import type { TradeDetailBounds, TradeTableFilterState } from './trade-table-filters';

export const JOURNAL_PAGE_LIMIT = 100;

const BOUND_MODE_BY_FILTER_MODE: Readonly<Record<NumberFilterMode, JournalPageBoundMode>> = {
  [NUMBER_FILTER_MODES.between]: 'between',
  [NUMBER_FILTER_MODES.equals]: 'equals',
  [NUMBER_FILTER_MODES.greaterThan]: 'greaterThan',
  [NUMBER_FILTER_MODES.lessThan]: 'lessThan',
};

const toBoundary = (dateKey: string, time: string, fallback: string): string =>
  // UTC boundaries mirror the previous client-side predicate exactly.
  `${dateKey}T${time === '' ? fallback : time}:00Z`;

export const toOccurredBoundaries = (
  range: DateTimeRangeFilterState,
): { readonly from: string | null; readonly to: string | null } => {
  if (isDateTimeRangeFilterStateDefault(range)) return { from: null, to: null };
  const sameDay = range.from !== '' && range.from === range.to;
  return {
    from: range.from === '' ? null : toBoundary(range.from, range.fromTime, '00:00'),
    to: range.to === '' ? null : toBoundary(range.to, range.toTime, sameDay ? '23:59' : '00:00'),
  };
};

const toBoundValue = (value: string): string | null => {
  const normalized = value.trim().replace(',', '.');
  return normalized === '' ? null : normalized;
};

const toResultBounds = (state: NumberFilterState): JournalPageFiltersDto['resultBounds'] => {
  if (isNumberFilterStateDefault(state)) return null;
  return {
    maximum: toBoundValue(state.maximum),
    minimum: toBoundValue(state.minimum),
    mode: BOUND_MODE_BY_FILTER_MODE[state.mode],
  };
};

const toDetailBounds = (state: TradeDetailBounds): JournalPageFiltersDto['detailBounds'] => {
  const bounds: Record<string, JournalPageResultBoundsDto> = {};
  (Object.keys(state) as TradeDetailNumericField[]).forEach((field) => {
    const value = state[field];
    if (value === undefined) return;
    const converted = toResultBounds(value);
    if (converted !== null) bounds[field] = converted;
  });
  return Object.keys(bounds).length === 0 ? null : bounds;
};

export const toJournalPageFilters = (state: TradeTableFilterState): JournalPageFiltersDto => {
  const occurred = toOccurredBoundaries(state.dateTimeRange);
  const textQuery = state.textQuery.trim();
  return {
    accountIds: state.accountFilterIds,
    categories: state.assetCategoryFilters,
    closedFromDate: state.dateFrom === '' ? null : state.dateFrom,
    closedToDate: state.dateTo === '' ? null : state.dateTo,
    detailBounds: toDetailBounds(state.detailBounds),
    entryKinds: state.entryFilters,
    includeUntagged: state.tagIncludeUntagged,
    includeUnassigned: state.accountIncludeUnassigned,
    instrumentIds: state.assetFilterIds,
    notePresence: state.notePresence,
    occurredFrom: occurred.from,
    occurredTo: occurred.to,
    resultBounds: toResultBounds(state.resultBounds),
    resultUnits: state.resultUnit === TRADE_RESULT_FILTERS.all ? [] : [state.resultUnit],
    reviewStatuses: state.reviewStatuses,
    tagIds: state.tagFilterIds,
    textQuery: textQuery === '' ? null : textQuery,
  };
};

export const toJournalPageSort = (
  sorting: SortingState,
): { readonly direction: 'asc' | 'desc'; readonly field: JournalPageSortField } => {
  const first = sorting[0];
  const field = first === undefined ? undefined : TRADE_TABLE_SORT_FIELDS[first.id];
  if (first === undefined || field === undefined) return { direction: 'desc', field: 'date' };
  return { direction: first.desc ? 'desc' : 'asc', field };
};

export const buildJournalPageRequest = (
  filters: TradeTableFilterState,
  sorting: SortingState,
  includeCashMovements: boolean,
  cursor: string | null,
): JournalPageRequestDto => ({
  cursor,
  filters: toJournalPageFilters(filters),
  includeCashMovements,
  limit: JOURNAL_PAGE_LIMIT,
  sort: toJournalPageSort(sorting),
});
