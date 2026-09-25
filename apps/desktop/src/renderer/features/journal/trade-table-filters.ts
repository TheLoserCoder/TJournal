import Decimal from 'decimal.js';

import type { InstrumentCategory, TradeResultKind } from '../../../shared/desktop-api';
import {
  createEmptyDateTimeRangeFilterState,
  isDateTimeRangeFilterStateDefault,
  type DateTimeRangeFilterState,
} from '../../components/ui/datetime-range-filter-state';
import {
  createEmptyNumberFilterState,
  isNumberFilterStateDefault,
  NUMBER_FILTER_MODES,
  type NumberFilterState,
} from '../../components/ui/number-filter-state';
import type { JournalEntryRow } from './journal-entry-row';
import { TRADE_RESULT_FILTERS, TRADE_TABLE_COLUMN_IDS } from './trade-table.config';

/** Sentinel option id for the "without tags" entry of the tag filter list. */
export const TRADE_TAG_UNTAGGED_FILTER_ID = '__untagged__';

export const TRADE_ENTRY_FILTERS = {
  deposit: 'deposit',
  long: 'long',
  short: 'short',
  withdrawal: 'withdrawal',
} as const;
export type TradeEntryFilter = (typeof TRADE_ENTRY_FILTERS)[keyof typeof TRADE_ENTRY_FILTERS];
export type TradeResultUnitFilter = TradeResultKind | 'all';

export interface TradeTableFilterState {
  readonly accountFilterIds: readonly string[];
  readonly accountIncludeUnassigned: boolean;
  readonly assetCategoryFilters: readonly InstrumentCategory[];
  readonly assetFilterIds: readonly string[];
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly dateTimeRange: DateTimeRangeFilterState;
  readonly entryFilters: readonly TradeEntryFilter[];
  readonly resultBounds: NumberFilterState;
  readonly resultUnit: TradeResultUnitFilter;
  readonly tagFilterIds: readonly string[];
  readonly tagIncludeUntagged: boolean;
  readonly textQuery: string;
}

export const createInitialTradeTableFilterState = (): TradeTableFilterState => ({
  accountFilterIds: [],
  accountIncludeUnassigned: false,
  assetCategoryFilters: [],
  assetFilterIds: [],
  dateFrom: '',
  dateTo: '',
  dateTimeRange: createEmptyDateTimeRangeFilterState(),
  entryFilters: [],
  resultBounds: createEmptyNumberFilterState(),
  resultUnit: TRADE_RESULT_FILTERS.all,
  tagFilterIds: [],
  tagIncludeUntagged: false,
  textQuery: '',
});

export interface TradeTableFilterAwareness {
  readonly account: boolean;
  readonly assetCategories: boolean;
  readonly assets: boolean;
  readonly date: boolean;
  readonly dateTime: boolean;
  readonly result: boolean;
  readonly resultUnit: boolean;
  readonly tags: boolean;
  readonly text: boolean;
  readonly types: boolean;
}

export const getTradeTableFilterAwareness = (
  state: TradeTableFilterState,
): TradeTableFilterAwareness => ({
  account: state.accountFilterIds.length > 0 || state.accountIncludeUnassigned,
  assetCategories: state.assetCategoryFilters.length > 0,
  assets: state.assetFilterIds.length > 0,
  date: state.dateFrom !== '' || state.dateTo !== '',
  dateTime: !isDateTimeRangeFilterStateDefault(state.dateTimeRange),
  result: !isNumberFilterStateDefault(state.resultBounds),
  resultUnit: state.resultUnit !== TRADE_RESULT_FILTERS.all,
  tags: state.tagFilterIds.length > 0 || state.tagIncludeUntagged,
  text: state.textQuery.trim() !== '',
  types: state.entryFilters.length > 0,
});

export const hasActiveTradeTableFilters = (state: TradeTableFilterState): boolean =>
  Object.values(getTradeTableFilterAwareness(state)).some(Boolean);

const TRADE_FILTER_AWARENESS_KEYS: Readonly<Record<string, keyof TradeTableFilterAwareness>> = {
  [TRADE_TABLE_COLUMN_IDS.account]: 'account',
  [TRADE_TABLE_COLUMN_IDS.asset]: 'assets',
  [TRADE_TABLE_COLUMN_IDS.assetCategory]: 'assetCategories',
  [TRADE_TABLE_COLUMN_IDS.closedAt]: 'date',
  [TRADE_TABLE_COLUMN_IDS.closedAtTime]: 'dateTime',
  [TRADE_TABLE_COLUMN_IDS.direction]: 'types',
  [TRADE_TABLE_COLUMN_IDS.id]: 'text',
  [TRADE_TABLE_COLUMN_IDS.result]: 'result',
  [TRADE_TABLE_COLUMN_IDS.resultKind]: 'resultUnit',
  [TRADE_TABLE_COLUMN_IDS.tags]: 'tags',
};

/** Per-column highlight: one applied filter never marks every header button. */
export const isTradeColumnFilterActive = (
  columnId: string,
  awareness: TradeTableFilterAwareness,
): boolean => {
  const key = TRADE_FILTER_AWARENESS_KEYS[columnId];
  return key === undefined ? false : awareness[key];
};

const compareDecimal = (left: string, right: string): number =>
  new Decimal(left).comparedTo(new Decimal(right));

/** Shared exact Decimal bounds predicate for the entity tables. */
export const matchesBounds = (value: string, state: NumberFilterState): boolean => {
  const min = state.minimum.trim().replace(',', '.');
  const max = state.maximum.trim().replace(',', '.');
  if (state.mode === NUMBER_FILTER_MODES.between) {
    if (min !== '' && compareDecimal(value, min) < 0) return false;
    if (max !== '' && compareDecimal(value, max) > 0) return false;
    return true;
  }
  if (state.mode === NUMBER_FILTER_MODES.equals) {
    return min !== '' && compareDecimal(value, min) === 0;
  }
  if (state.mode === NUMBER_FILTER_MODES.greaterThan) {
    return min === '' || compareDecimal(value, min) > 0;
  }
  return max === '' || compareDecimal(value, max) < 0;
};

export const matchesNumericBounds = matchesBounds;

/**
 * Authoritative USD amount of one row. Percent/R trades without a saved USD
 * snapshot stay `null`; they are never silently rebased on today's balance.
 */
export const getJournalEntryAmountUsd = (row: JournalEntryRow): string | null => {
  if (row.kind === 'trade') {
    if (row.trade.netResultUsd !== undefined) return row.trade.netResultUsd;
    const impact = row.trade.account?.balanceImpactUsd;
    return impact === undefined || impact === null ? null : impact;
  }
  return row.kind === TRADE_ENTRY_FILTERS.deposit
    ? row.movement.amountUsd
    : new Decimal(row.movement.amountUsd).negated().toFixed();
};
