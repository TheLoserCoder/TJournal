import {
  JOURNAL_TABLE_DETAIL_NUMERIC_FIELDS,
  JOURNAL_TABLE_ENTRY_KINDS,
  JOURNAL_TABLE_NOTE_PRESENCE,
  JOURNAL_TABLE_SORT_FIELDS,
  NUMBER_BOUND_MODES,
  type JournalTableDetailNumericField,
  type JournalTableFilters,
  type JournalTableResultBounds,
  type JournalTableSort,
  type JournalTableSortDirection,
} from '@tjournal/trade';

import type { CursorTraversal, CursorValue } from './sqlite-journal-table-cursor';
import { SQLITE_JOURNAL_TABLE_FUNCTIONS } from './sqlite-journal-table-functions';

export const TRADE_ROW_PREFIX = 'trade:';
export const MOVEMENT_ROW_PREFIX = 'cash-movement:';

export type DatabaseParameter = string | number | null;

export interface SortKey {
  readonly direction: JournalTableSortDirection;
  readonly expression: string;
}

export interface SqlFragment {
  readonly parameters: readonly DatabaseParameter[];
  readonly sql: string;
}

export interface CandidateRow {
  readonly account_id: string | null;
  readonly account_name: string | null;
  readonly amount_text: string | null;
  readonly direction: string | null;
  readonly id: string;
  readonly instrument_symbol: string | null;
  readonly movement_kind: string | null;
  readonly occurred_at: string;
  readonly row_kind: 'trade' | 'movement';
}

const TRADE_AMOUNT_EXPRESSION =
  'COALESCE(trades.net_result_usd, trades.account_balance_impact_usd)';
const MOVEMENT_AMOUNT_EXPRESSION = `CASE WHEN cash_movements.kind = 'withdrawal' THEN '-' || cash_movements.amount_usd ELSE cash_movements.amount_usd END`;

export const buildSortKeys = (sort: JournalTableSort): readonly SortKey[] => {
  const { direction } = sort;
  switch (sort.field) {
    case JOURNAL_TABLE_SORT_FIELDS.result:
      return [
        { direction: 'asc', expression: '(amount_text IS NULL)' },
        { direction, expression: 'CAST(amount_text AS REAL)' },
        { direction, expression: 'amount_text' },
        { direction, expression: 'id' },
      ];
    case JOURNAL_TABLE_SORT_FIELDS.asset:
      return [
        { direction: 'asc', expression: '(instrument_symbol IS NULL)' },
        { direction, expression: 'instrument_symbol COLLATE NOCASE' },
        { direction, expression: 'id' },
      ];
    case JOURNAL_TABLE_SORT_FIELDS.type:
      return [
        { direction: 'asc', expression: '(COALESCE(direction, movement_kind) IS NULL)' },
        { direction, expression: "COALESCE(direction, movement_kind, '')" },
        { direction, expression: 'id' },
      ];
    case JOURNAL_TABLE_SORT_FIELDS.account:
      return [
        { direction: 'asc', expression: '(account_name IS NULL)' },
        { direction, expression: "COALESCE(account_name, '') COLLATE NOCASE" },
        { direction, expression: 'id' },
      ];
    default:
      return [
        { direction, expression: 'occurred_at' },
        { direction: 'asc', expression: "CASE row_kind WHEN 'trade' THEN 0 ELSE 1 END" },
        { direction, expression: 'id' },
      ];
  }
};

const reverseDirection = (direction: JournalTableSortDirection): JournalTableSortDirection =>
  direction === 'asc' ? 'desc' : 'asc';

export const traversalDirection = (
  direction: JournalTableSortDirection,
  traversal: CursorTraversal,
): JournalTableSortDirection => (traversal === 'after' ? direction : reverseDirection(direction));

export const buildKeyset = (
  keys: readonly SortKey[],
  values: readonly CursorValue[],
  traversal: CursorTraversal,
): SqlFragment => {
  const branches: string[] = [];
  const parameters: DatabaseParameter[] = [];
  keys.forEach((key, index) => {
    const parts: string[] = [];
    for (let position = 0; position < index; position += 1) {
      const previousKey = keys[position];
      if (previousKey === undefined) continue;
      parts.push(`${previousKey.expression} IS ?`);
      parameters.push(values[position] ?? null);
    }
    const direction = traversalDirection(key.direction, traversal);
    parts.push(`${key.expression} ${direction === 'desc' ? '<' : '>'} ?`);
    parameters.push(values[index] ?? null);
    branches.push(`(${parts.join(' AND ')})`);
  });
  return { parameters, sql: branches.join(' OR ') };
};

export const toCursorValues = (
  row: CandidateRow,
  keys: readonly SortKey[],
): readonly CursorValue[] => keys.map((key) => valueForSortKey(row, key.expression));

const valueForSortKey = (row: CandidateRow, expression: string): CursorValue => {
  if (expression === 'occurred_at') return row.occurred_at;
  if (expression === 'amount_text') return row.amount_text;
  if (expression === 'CAST(amount_text AS REAL)') {
    return row.amount_text === null ? null : Number(row.amount_text);
  }
  if (expression === '(amount_text IS NULL)') return row.amount_text === null ? 1 : 0;
  if (expression === 'instrument_symbol COLLATE NOCASE') return row.instrument_symbol;
  if (expression === '(instrument_symbol IS NULL)') return row.instrument_symbol === null ? 1 : 0;
  if (expression === "COALESCE(direction, movement_kind, '')") {
    return row.direction ?? row.movement_kind ?? '';
  }
  if (expression === '(COALESCE(direction, movement_kind) IS NULL)') {
    return row.direction === null && row.movement_kind === null ? 1 : 0;
  }
  if (expression === "COALESCE(account_name, '') COLLATE NOCASE") {
    return row.account_name ?? '';
  }
  if (expression === '(account_name IS NULL)') return row.account_name === null ? 1 : 0;
  if (expression === "CASE row_kind WHEN 'trade' THEN 0 ELSE 1 END") {
    return row.row_kind === 'trade' ? 0 : 1;
  }
  return row.id;
};

const buildBoundsSql = (
  amountExpression: string,
  bounds: JournalTableResultBounds,
): SqlFragment | null => {
  const comparisons: string[] = [];
  const parameters: DatabaseParameter[] = [];
  const compare = (operator: string, bound: string): void => {
    comparisons.push(
      `${SQLITE_JOURNAL_TABLE_FUNCTIONS.decimalComparator}(${amountExpression}, ?) ${operator} 0`,
    );
    parameters.push(bound);
  };
  if (bounds.mode === NUMBER_BOUND_MODES.between) {
    if (bounds.minimum !== null) compare('>=', bounds.minimum);
    if (bounds.maximum !== null) compare('<=', bounds.maximum);
  } else if (bounds.mode === NUMBER_BOUND_MODES.equals) {
    if (bounds.minimum !== null) compare('=', bounds.minimum);
  } else if (bounds.mode === NUMBER_BOUND_MODES.greaterThan) {
    if (bounds.minimum !== null) compare('>', bounds.minimum);
  } else if (bounds.maximum !== null) {
    compare('<', bounds.maximum);
  }
  if (comparisons.length === 0) return null;
  return {
    parameters,
    sql: [`${amountExpression} IS NOT NULL`, ...comparisons].join(' AND '),
  };
};

const buildBoundsFragment = (
  amountExpression: string,
  filters: JournalTableFilters,
): SqlFragment | null =>
  filters.resultBounds === null ? null : buildBoundsSql(amountExpression, filters.resultBounds);

/** SQLite expression behind each detail numeric filter. */
const DETAIL_BOUND_EXPRESSIONS: Readonly<Record<JournalTableDetailNumericField, string>> = {
  [JOURNAL_TABLE_DETAIL_NUMERIC_FIELDS.commission]: 'trades.commission_usd',
  [JOURNAL_TABLE_DETAIL_NUMERIC_FIELDS.entryPrice]: 'trades.entry_price',
  [JOURNAL_TABLE_DETAIL_NUMERIC_FIELDS.exitCount]:
    '(SELECT COUNT(*) FROM trade_exits WHERE trade_id = trades.id)',
  [JOURNAL_TABLE_DETAIL_NUMERIC_FIELDS.quantity]: 'trades.quantity_lots',
  [JOURNAL_TABLE_DETAIL_NUMERIC_FIELDS.spread]: 'trades.spread_ticks',
  [JOURNAL_TABLE_DETAIL_NUMERIC_FIELDS.stopLoss]: 'trades.stop_loss_price',
};

const hasDetailFilters = (filters: JournalTableFilters): boolean =>
  filters.reviewStatuses.length > 0 ||
  filters.notePresence.length > 0 ||
  (filters.detailBounds !== null && Object.keys(filters.detailBounds).length > 0);

const buildTagsFragment = (tableName: string, filters: JournalTableFilters): SqlFragment | null => {
  const tagIds = filters.tagIds;
  if (tagIds.length === 0) {
    return filters.includeUntagged
      ? {
          parameters: [],
          sql: `NOT EXISTS (SELECT 1 FROM trade_tags WHERE trade_id = ${tableName}.id)`,
        }
      : null;
  }
  const placeholders = tagIds.map(() => '?').join(', ');
  const exists = `EXISTS (SELECT 1 FROM trade_tags WHERE trade_id = ${tableName}.id AND tag_id IN (${placeholders}))`;
  if (!filters.includeUntagged) return { parameters: tagIds, sql: exists };
  return {
    parameters: tagIds,
    sql: `(${exists} OR NOT EXISTS (SELECT 1 FROM trade_tags WHERE trade_id = ${tableName}.id))`,
  };
};

const hasIntersection = <T extends string>(
  requested: readonly T[],
  allowed: readonly T[],
): readonly T[] => requested.filter((value) => allowed.includes(value));

export const buildTradeArm = (filters: JournalTableFilters): SqlFragment => {
  const parameters: DatabaseParameter[] = [];
  const conditions: string[] = [];
  if (filters.textQuery !== null && filters.textQuery.trim() !== '') {
    conditions.push(
      `(instr(${SQLITE_JOURNAL_TABLE_FUNCTIONS.unicodeLowercase}('${TRADE_ROW_PREFIX}' || trades.id), ${SQLITE_JOURNAL_TABLE_FUNCTIONS.unicodeLowercase}(?)) > 0 OR instr(${SQLITE_JOURNAL_TABLE_FUNCTIONS.unicodeLowercase}(COALESCE(trades.entry_note, '')), ${SQLITE_JOURNAL_TABLE_FUNCTIONS.unicodeLowercase}(?)) > 0 OR instr(${SQLITE_JOURNAL_TABLE_FUNCTIONS.unicodeLowercase}(COALESCE(trades.review_note, '')), ${SQLITE_JOURNAL_TABLE_FUNCTIONS.unicodeLowercase}(?)) > 0)`,
    );
    parameters.push(filters.textQuery.trim(), filters.textQuery.trim(), filters.textQuery.trim());
  }
  if (filters.entryKinds.length > 0) {
    const directions = hasIntersection(filters.entryKinds, [
      JOURNAL_TABLE_ENTRY_KINDS.long,
      JOURNAL_TABLE_ENTRY_KINDS.short,
    ]);
    if (directions.length === 0) conditions.push('0');
    else {
      conditions.push(`trades.direction IN (${directions.map(() => '?').join(', ')})`);
      parameters.push(...directions);
    }
  }
  if (filters.instrumentIds.length > 0) {
    conditions.push(`trades.instrument_id IN (${filters.instrumentIds.map(() => '?').join(', ')})`);
    parameters.push(...filters.instrumentIds);
  }
  if (filters.categories.length > 0) {
    conditions.push(`instruments.category IN (${filters.categories.map(() => '?').join(', ')})`);
    parameters.push(...filters.categories);
  }
  if (filters.accountIds.length > 0 || filters.includeUnassigned) {
    const parts: string[] = [];
    if (filters.accountIds.length > 0) {
      parts.push(`trades.account_id IN (${filters.accountIds.map(() => '?').join(', ')})`);
      parameters.push(...filters.accountIds);
    }
    if (filters.includeUnassigned) parts.push('trades.account_id IS NULL');
    conditions.push(`(${parts.join(' OR ')})`);
  }
  if (filters.closedFromDate !== null) {
    conditions.push('substr(trades.closed_at, 1, 10) >= ?');
    parameters.push(filters.closedFromDate);
  }
  if (filters.closedToDate !== null) {
    conditions.push('substr(trades.closed_at, 1, 10) <= ?');
    parameters.push(filters.closedToDate);
  }
  if (filters.occurredFrom !== null) {
    conditions.push('trades.closed_at >= ?');
    parameters.push(filters.occurredFrom);
  }
  if (filters.occurredTo !== null) {
    conditions.push('trades.closed_at <= ?');
    parameters.push(filters.occurredTo);
  }
  if (filters.resultUnits.length > 0) {
    conditions.push(
      `COALESCE(trades.input_result_kind, trades.result_kind) IN (${filters.resultUnits.map(() => '?').join(', ')})`,
    );
    parameters.push(...filters.resultUnits);
  }
  if (filters.reviewStatuses.length > 0) {
    conditions.push(
      `trades.review_status IN (${filters.reviewStatuses.map(() => '?').join(', ')})`,
    );
    parameters.push(...filters.reviewStatuses);
  }
  if (filters.notePresence.length > 0) {
    const notes = filters.notePresence.map((presence) =>
      presence === JOURNAL_TABLE_NOTE_PRESENCE.entry
        ? "COALESCE(trades.entry_note, '') <> ''"
        : "COALESCE(trades.review_note, '') <> ''",
    );
    conditions.push(`(${notes.join(' OR ')})`);
  }
  if (filters.detailBounds !== null) {
    for (const field of Object.keys(filters.detailBounds) as JournalTableDetailNumericField[]) {
      const bounds = filters.detailBounds[field];
      if (bounds === undefined) continue;
      const fragment = buildBoundsSql(DETAIL_BOUND_EXPRESSIONS[field], bounds);
      if (fragment !== null) {
        conditions.push(`(${fragment.sql})`);
        parameters.push(...fragment.parameters);
      }
    }
  }
  const tags = buildTagsFragment('trades', filters);
  if (tags !== null) {
    conditions.push(`(${tags.sql})`);
    parameters.push(...tags.parameters);
  }
  const bounds = buildBoundsFragment(TRADE_AMOUNT_EXPRESSION, filters);
  if (bounds !== null) {
    conditions.push(`(${bounds.sql})`);
    parameters.push(...bounds.parameters);
  }
  return {
    parameters,
    sql: `SELECT 'trade' AS row_kind, trades.id AS id, trades.closed_at AS occurred_at, trades.direction AS direction, NULL AS movement_kind, trades.instrument_id AS instrument_id, instruments.symbol AS instrument_symbol, trades.account_id AS account_id, trades.account_name_snapshot AS account_name, ${TRADE_AMOUNT_EXPRESSION} AS amount_text FROM trades JOIN instruments ON instruments.id = trades.instrument_id WHERE ${conditions.length === 0 ? '1' : conditions.join(' AND ')}`,
  };
};

export const buildMovementArm = (filters: JournalTableFilters): SqlFragment => {
  const parameters: DatabaseParameter[] = [];
  const conditions: string[] = [];
  if (filters.textQuery !== null && filters.textQuery.trim() !== '') {
    conditions.push(
      `instr(${SQLITE_JOURNAL_TABLE_FUNCTIONS.unicodeLowercase}('${MOVEMENT_ROW_PREFIX}' || cash_movements.id), ${SQLITE_JOURNAL_TABLE_FUNCTIONS.unicodeLowercase}(?)) > 0`,
    );
    parameters.push(filters.textQuery.trim());
  }
  if (filters.entryKinds.length > 0) {
    const kinds = hasIntersection(filters.entryKinds, [
      JOURNAL_TABLE_ENTRY_KINDS.deposit,
      JOURNAL_TABLE_ENTRY_KINDS.withdrawal,
    ]);
    if (kinds.length === 0) conditions.push('0');
    else {
      conditions.push(`cash_movements.kind IN (${kinds.map(() => '?').join(', ')})`);
      parameters.push(...kinds);
    }
  }
  if (
    filters.instrumentIds.length > 0 ||
    filters.categories.length > 0 ||
    filters.resultUnits.length > 0 ||
    hasDetailFilters(filters)
  ) {
    conditions.push('0');
  }
  if (filters.accountIds.length > 0 || filters.includeUnassigned) {
    const parts: string[] = [];
    if (filters.accountIds.length > 0) {
      parts.push(`cash_movements.account_id IN (${filters.accountIds.map(() => '?').join(', ')})`);
      parameters.push(...filters.accountIds);
    }
    if (filters.includeUnassigned) parts.push('cash_movements.account_id IS NULL');
    conditions.push(`(${parts.join(' OR ')})`);
  }
  if (filters.closedFromDate !== null) {
    conditions.push('substr(cash_movements.occurred_at, 1, 10) >= ?');
    parameters.push(filters.closedFromDate);
  }
  if (filters.closedToDate !== null) {
    conditions.push('substr(cash_movements.occurred_at, 1, 10) <= ?');
    parameters.push(filters.closedToDate);
  }
  if (filters.occurredFrom !== null) {
    conditions.push('cash_movements.occurred_at >= ?');
    parameters.push(filters.occurredFrom);
  }
  if (filters.occurredTo !== null) {
    conditions.push('cash_movements.occurred_at <= ?');
    parameters.push(filters.occurredTo);
  }
  if (!filters.includeUntagged && filters.tagIds.length > 0) conditions.push('0');
  const bounds = buildBoundsFragment(MOVEMENT_AMOUNT_EXPRESSION, filters);
  if (bounds !== null) {
    conditions.push(`(${bounds.sql})`);
    parameters.push(...bounds.parameters);
  }
  return {
    parameters,
    sql: `SELECT 'movement' AS row_kind, cash_movements.id AS id, cash_movements.occurred_at AS occurred_at, NULL AS direction, cash_movements.kind AS movement_kind, NULL AS instrument_id, NULL AS instrument_symbol, cash_movements.account_id AS account_id, cash_movements.account_name_snapshot AS account_name, ${MOVEMENT_AMOUNT_EXPRESSION} AS amount_text FROM cash_movements WHERE ${conditions.length === 0 ? '1' : conditions.join(' AND ')}`,
  };
};
