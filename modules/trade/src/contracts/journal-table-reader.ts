import type { InstrumentCategory } from '@tjournal/instrument';

import type { ClosedTrade, TradeResultKind } from '../domain/trade';

export const JOURNAL_TABLE_SORT_FIELDS = {
  account: 'account',
  asset: 'asset',
  date: 'date',
  result: 'result',
  type: 'type',
} as const;
export type JournalTableSortField =
  (typeof JOURNAL_TABLE_SORT_FIELDS)[keyof typeof JOURNAL_TABLE_SORT_FIELDS];
export type JournalTableSortDirection = 'asc' | 'desc';

export interface JournalTableSort {
  readonly direction: JournalTableSortDirection;
  readonly field: JournalTableSortField;
}

export const JOURNAL_TABLE_ENTRY_KINDS = {
  deposit: 'deposit',
  long: 'long',
  short: 'short',
  withdrawal: 'withdrawal',
} as const;
export type JournalTableEntryKind =
  (typeof JOURNAL_TABLE_ENTRY_KINDS)[keyof typeof JOURNAL_TABLE_ENTRY_KINDS];

export const NUMBER_BOUND_MODES = {
  between: 'between',
  equals: 'equals',
  greaterThan: 'greaterThan',
  lessThan: 'lessThan',
} as const;
export type NumberBoundMode = (typeof NUMBER_BOUND_MODES)[keyof typeof NUMBER_BOUND_MODES];

/** Exact Decimal bounds on the authoritative USD amount of an entry. */
export interface JournalTableResultBounds {
  readonly maximum: string | null;
  readonly minimum: string | null;
  readonly mode: NumberBoundMode;
}

export interface JournalTableFilters {
  readonly accountIds: readonly string[];
  readonly categories: readonly InstrumentCategory[];
  /** `YYYY-MM-DD` UTC date, inclusive. */
  readonly closedFromDate: string | null;
  /** `YYYY-MM-DD` UTC date, inclusive. */
  readonly closedToDate: string | null;
  readonly entryKinds: readonly JournalTableEntryKind[];
  readonly includeUntagged: boolean;
  readonly includeUnassigned: boolean;
  readonly instrumentIds: readonly string[];
  /** ISO instant, inclusive; mirrors the existing date-time range filter. */
  readonly occurredFrom: string | null;
  readonly occurredTo: string | null;
  readonly resultBounds: JournalTableResultBounds | null;
  readonly resultUnits: readonly TradeResultKind[];
  readonly tagIds: readonly string[];
  /** Case-insensitive substring match on row identifiers and trade notes. */
  readonly textQuery: string | null;
}

export interface JournalTableQuery {
  /** Opaque forward or backward keyset cursor returned by an adjacent page. */
  readonly cursor: string | null;
  readonly filters: JournalTableFilters;
  readonly includeCashMovements: boolean;
  readonly limit: number;
  readonly sort: JournalTableSort;
}

export interface JournalTableMovementRow {
  readonly accountId: string;
  readonly accountName: string;
  readonly amountUsd: string;
  readonly id: string;
  readonly kind: 'deposit' | 'withdrawal';
  readonly occurredAt: string;
}

/** Lean table row; execution and qualitative notes are loaded only for details. */
export type JournalTableTradeRow = Omit<
  ClosedTrade,
  'entryNote' | 'execution' | 'reviewNote' | 'reviewStatus'
>;

export interface JournalTableTradeSource {
  getJournalTableTradesByIds(ids: readonly string[]): readonly JournalTableTradeRow[];
}

export type JournalTableRow =
  | {
      /** Stable table identity, prefixed so trade and movement ids cannot collide. */
      readonly id: string;
      readonly kind: 'trade';
      readonly occurredAt: string;
      readonly trade: JournalTableTradeRow;
    }
  | {
      /** Stable table identity, prefixed so trade and movement ids cannot collide. */
      readonly id: string;
      readonly kind: 'movement';
      readonly movement: JournalTableMovementRow;
      readonly occurredAt: string;
    };

export interface JournalTablePage {
  readonly nextCursor: string | null;
  readonly previousCursor: string | null;
  readonly rows: readonly JournalTableRow[];
  /** Entries in the whole journal, independent of filters; drives the empty state. */
  readonly totalEntryCount: number;
  /** Accountless legacy trades; the workspace shows its migration banner from this count. */
  readonly unassignedTradeCount: number;
}

export const MAX_JOURNAL_TABLE_PAGE_SIZE = 200;

/**
 * Bounded read model for the merged journal table. The trades journal owns the
 * contract; cash-movement rows are a consumer-owned read DTO so the contract
 * does not depend on the account module.
 */
export interface JournalTableReader {
  readPage(query: JournalTableQuery): JournalTablePage;
}
