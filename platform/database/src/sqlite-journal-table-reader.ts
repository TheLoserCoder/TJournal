import type { DatabaseSync } from 'node:sqlite';

import { AppError } from '@tjournal/platform-errors';
import {
  JOURNAL_TABLE_ENTRY_KINDS,
  JOURNAL_TABLE_SORT_FIELDS,
  MAX_JOURNAL_TABLE_PAGE_SIZE,
  NUMBER_BOUND_MODES,
  type JournalTableFilters,
  type JournalTablePage,
  type JournalTableQuery,
  type JournalTableReader,
  type JournalTableRow,
  type JournalTableTradeSource,
  type JournalTableSort,
  type JournalTableSortDirection,
  type JournalTableSortField,
} from '@tjournal/trade';

import { SqliteVaultDatabase } from './sqlite-vault-database';
import {
  registerSqliteJournalTableFunctions,
  SQLITE_JOURNAL_TABLE_FUNCTIONS,
} from './sqlite-journal-table-functions';

const TRADE_ROW_PREFIX = 'trade:';
const MOVEMENT_ROW_PREFIX = 'cash-movement:';
const CURSOR_VERSION = 2;

type CursorValue = string | number | null;
type DatabaseParameter = string | number | null;
type CursorTraversal = 'after' | 'before';

interface SortKey {
  readonly direction: JournalTableSortDirection;
  readonly expression: string;
}

interface SqlFragment {
  readonly parameters: readonly DatabaseParameter[];
  readonly sql: string;
}

interface CandidateRow {
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

interface CursorPayload {
  readonly direction: JournalTableSortDirection;
  readonly field: JournalTableSortField;
  readonly traversal: CursorTraversal;
  readonly v: number;
  readonly values: readonly CursorValue[];
}

const TRADE_AMOUNT_EXPRESSION =
  'COALESCE(trades.net_result_usd, trades.account_balance_impact_usd)';
const MOVEMENT_AMOUNT_EXPRESSION = `CASE WHEN cash_movements.kind = 'withdrawal' THEN '-' || cash_movements.amount_usd ELSE cash_movements.amount_usd END`;

const buildSortKeys = (sort: JournalTableSort): readonly SortKey[] => {
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

const traversalDirection = (
  direction: JournalTableSortDirection,
  traversal: CursorTraversal,
): JournalTableSortDirection => (traversal === 'after' ? direction : reverseDirection(direction));

const buildKeyset = (
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

const toCursorValues = (row: CandidateRow, keys: readonly SortKey[]): readonly CursorValue[] =>
  keys.map((key) => valueForSortKey(row, key.expression));

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

const encodeCursor = (
  sort: JournalTableSort,
  values: readonly CursorValue[],
  traversal: CursorTraversal,
): string =>
  Buffer.from(
    JSON.stringify({
      direction: sort.direction,
      field: sort.field,
      traversal,
      v: CURSOR_VERSION,
      values,
    } satisfies CursorPayload),
    'utf8',
  ).toString('base64url');

const decodeCursor = (
  cursor: string,
  sort: JournalTableSort,
  keyCount: number,
): Pick<CursorPayload, 'traversal' | 'values'> => {
  const invalid = (): never => {
    throw new AppError({
      code: 'validation-invalid',
      issues: [{ code: 'invalid-cursor', path: 'cursor' }],
      message: 'The journal page cursor is invalid.',
    });
  };
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return invalid();
  }
  if (typeof payload !== 'object' || payload === null) return invalid();
  const candidate = payload as Partial<CursorPayload>;
  if (candidate.v !== CURSOR_VERSION) return invalid();
  if (candidate.field !== sort.field || candidate.direction !== sort.direction) return invalid();
  if (candidate.traversal !== 'after' && candidate.traversal !== 'before') return invalid();
  if (!Array.isArray(candidate.values) || candidate.values.length !== keyCount) return invalid();
  if (
    !candidate.values.every(
      (value) => value === null || typeof value === 'string' || typeof value === 'number',
    )
  ) {
    return invalid();
  }
  return { traversal: candidate.traversal, values: candidate.values };
};

const buildBoundsFragment = (
  amountExpression: string,
  filters: JournalTableFilters,
): SqlFragment | null => {
  const bounds = filters.resultBounds;
  if (bounds === null) return null;
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

const buildTradeArm = (filters: JournalTableFilters): SqlFragment => {
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

const buildMovementArm = (filters: JournalTableFilters): SqlFragment => {
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
    filters.resultUnits.length > 0
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

export class SqliteJournalTableReader implements JournalTableReader {
  private registeredFunctionsDatabase: DatabaseSync | null = null;

  public constructor(
    private readonly vaultDatabase: SqliteVaultDatabase,
    private readonly tradeStore: JournalTableTradeSource,
  ) {}

  public readPage(query: JournalTableQuery): JournalTablePage {
    if (query.limit < 1 || query.limit > MAX_JOURNAL_TABLE_PAGE_SIZE) {
      throw new AppError({
        code: 'validation-invalid',
        issues: [{ code: 'page-size-invalid', path: 'limit' }],
        message: 'The journal page size is invalid.',
      });
    }
    const database = this.vaultDatabase.require();
    this.registerSqliteFunctions(database);

    const keys = buildSortKeys(query.sort);
    const cursor =
      query.cursor === null
        ? { traversal: 'after' as const, values: null }
        : decodeCursor(query.cursor, query.sort, keys.length);
    const keyset =
      cursor.values === null ? null : buildKeyset(keys, cursor.values, cursor.traversal);

    const tradeArm = buildTradeArm(query.filters);
    const arms = [tradeArm];
    if (query.includeCashMovements) arms.push(buildMovementArm(query.filters));

    const orderBy = keys
      .map((key) => `${key.expression} ${traversalDirection(key.direction, cursor.traversal)}`)
      .join(', ');
    const sql = `SELECT * FROM (${arms.map((arm) => arm.sql).join(' UNION ALL ')}) AS entries${keyset === null ? '' : ` WHERE ${keyset.sql}`} ORDER BY ${orderBy} LIMIT ?`;
    const parameters = [
      ...arms.flatMap((arm) => arm.parameters),
      ...(keyset?.parameters ?? []),
      query.limit,
    ];
    const queriedCandidates = database
      .prepare(sql)
      .all(...parameters) as unknown as readonly CandidateRow[];
    const candidates =
      cursor.traversal === 'before' ? [...queriedCandidates].reverse() : queriedCandidates;

    const tradeIds = candidates
      .filter((candidate) => candidate.row_kind === 'trade')
      .map((candidate) => candidate.id);
    const tradesById = new Map(
      this.tradeStore.getJournalTableTradesByIds(tradeIds).map((trade) => [trade.id, trade]),
    );
    const rows: JournalTableRow[] = [];
    for (const candidate of candidates) {
      if (candidate.row_kind === 'trade') {
        const trade = tradesById.get(candidate.id);
        if (trade !== undefined) {
          rows.push({
            id: `${TRADE_ROW_PREFIX}${candidate.id}`,
            kind: 'trade',
            occurredAt: candidate.occurred_at,
            trade,
          });
        }
        continue;
      }
      rows.push({
        id: `${MOVEMENT_ROW_PREFIX}${candidate.id}`,
        kind: 'movement',
        movement: {
          accountId: candidate.account_id ?? '',
          accountName: candidate.account_name ?? '',
          amountUsd: candidate.amount_text ?? '0',
          id: candidate.id,
          kind:
            candidate.movement_kind === 'withdrawal'
              ? ('withdrawal' as const)
              : ('deposit' as const),
          occurredAt: candidate.occurred_at,
        },
        occurredAt: candidate.occurred_at,
      });
    }

    const firstCandidate = candidates[0];
    const lastCandidate = candidates[candidates.length - 1];
    const pageIsFull = candidates.length === query.limit;
    const previousCursor =
      firstCandidate === undefined ||
      (cursor.traversal === 'after' ? query.cursor === null : !pageIsFull)
        ? null
        : encodeCursor(query.sort, toCursorValues(firstCandidate, keys), 'before');
    const nextCursor =
      lastCandidate === undefined || (cursor.traversal === 'after' ? !pageIsFull : false)
        ? null
        : encodeCursor(query.sort, toCursorValues(lastCandidate, keys), 'after');
    const unassignedRow = database
      .prepare('SELECT COUNT(*) AS count FROM trades WHERE account_id IS NULL')
      .get() as { readonly count: number };
    const totalRow = database
      .prepare(
        'SELECT (SELECT COUNT(*) FROM trades) + (SELECT COUNT(*) FROM cash_movements) AS count',
      )
      .get() as { readonly count: number };
    return {
      nextCursor,
      previousCursor,
      rows,
      totalEntryCount: Number(totalRow.count ?? 0),
      unassignedTradeCount: Number(unassignedRow.count ?? 0),
    };
  }

  private registerSqliteFunctions(database: DatabaseSync): void {
    if (this.registeredFunctionsDatabase === database) return;
    registerSqliteJournalTableFunctions(database);
    this.registeredFunctionsDatabase = database;
  }
}
