import type { InstrumentCategory } from '@tjournal/instrument';

import type { ClosedTrade, TradeResultKind, TradeReviewStatus } from '../domain/trade';

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

/**
 * Optional numeric detail columns a trade row exposes without loading the
 * execution aggregate. Each one can carry its own exact Decimal bounds.
 */
export const JOURNAL_TABLE_DETAIL_NUMERIC_FIELDS = {
  commission: 'commission',
  entryPrice: 'entryPrice',
  exitCount: 'exitCount',
  quantity: 'quantity',
  spread: 'spread',
  stopLoss: 'stopLoss',
} as const;
export type JournalTableDetailNumericField =
  (typeof JOURNAL_TABLE_DETAIL_NUMERIC_FIELDS)[keyof typeof JOURNAL_TABLE_DETAIL_NUMERIC_FIELDS];

/** Presence of the qualitative notes, used by the notes filter. */
export const JOURNAL_TABLE_NOTE_PRESENCE = { entry: 'entry', review: 'review' } as const;
export type JournalTableNotePresence =
  (typeof JOURNAL_TABLE_NOTE_PRESENCE)[keyof typeof JOURNAL_TABLE_NOTE_PRESENCE];

export interface JournalTableFilters {
  readonly accountIds: readonly string[];
  readonly categories: readonly InstrumentCategory[];
  /** `YYYY-MM-DD` UTC date, inclusive. */
  readonly closedFromDate: string | null;
  /** `YYYY-MM-DD` UTC date, inclusive. */
  readonly closedToDate: string | null;
  /** Exact Decimal bounds per detail column; a missing key means no filter. */
  readonly detailBounds: Readonly<
    Partial<Record<JournalTableDetailNumericField, JournalTableResultBounds>>
  > | null;
  readonly entryKinds: readonly JournalTableEntryKind[];
  readonly includeUntagged: boolean;
  readonly includeUnassigned: boolean;
  readonly instrumentIds: readonly string[];
  /** Requires at least one of the selected notes to be present. */
  readonly notePresence: readonly JournalTableNotePresence[];
  /** ISO instant, inclusive; mirrors the existing date-time range filter. */
  readonly occurredFrom: string | null;
  readonly occurredTo: string | null;
  readonly resultBounds: JournalTableResultBounds | null;
  readonly resultUnits: readonly TradeResultKind[];
  readonly reviewStatuses: readonly TradeReviewStatus[];
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

/**
 * Bounded detail projection of a trade row: scalar execution fields, the exit
 * count and note presence are safe to send with a page, while the full
 * execution aggregate and the note contents still require the point lookup.
 */
export interface JournalTableTradeDetails {
  readonly commissionUsd: string | null;
  readonly entryPrice: string | null;
  readonly exitCount: number;
  readonly hasEntryNote: boolean;
  readonly hasReviewNote: boolean;
  readonly quantityLots: string | null;
  readonly reviewStatus: TradeReviewStatus;
  readonly spreadTicks: string | null;
  readonly stopLossPrice: string | null;
}

/** Lean table row; note contents and the full execution aggregate stay out. */
export type JournalTableTradeRow = Omit<
  ClosedTrade,
  'entryNote' | 'execution' | 'reviewNote' | 'reviewStatus'
> &
  JournalTableTradeDetails;

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
