import type { DatabaseSync } from 'node:sqlite';

import { AppError } from '@tjournal/platform-errors';
import {
  MAX_JOURNAL_TABLE_PAGE_SIZE,
  type JournalTablePage,
  type JournalTableQuery,
  type JournalTableReader,
  type JournalTableRow,
  type JournalTableTradeSource,
} from '@tjournal/trade';

import { SqliteVaultDatabase } from './sqlite-vault-database';
import { decodeCursor, encodeCursor } from './sqlite-journal-table-cursor';
import { registerSqliteJournalTableFunctions } from './sqlite-journal-table-functions';
import {
  buildKeyset,
  buildMovementArm,
  buildSortKeys,
  buildTradeArm,
  MOVEMENT_ROW_PREFIX,
  toCursorValues,
  traversalDirection,
  TRADE_ROW_PREFIX,
  type CandidateRow,
} from './sqlite-journal-table-sql';

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
