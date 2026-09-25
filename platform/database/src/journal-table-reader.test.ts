// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { AppError } from '@tjournal/platform-errors';
import {
  TRADE_DIRECTIONS,
  TRADE_RESULT_KINDS,
  TRADE_RESULT_SOURCES,
  type JournalTableFilters,
  type JournalTableQuery,
  type JournalTableRow,
} from '@tjournal/trade';

import { SqliteAccountStore } from './sqlite-account-store';
import { SqliteInstrumentStore } from './sqlite-instrument-store';
import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteJournalTableReader } from './sqlite-journal-table-reader';
import { SqliteTagStore } from './sqlite-tag-store';
import { SqliteTradeStore } from './sqlite-trade-store';
import { SqliteVaultDatabase } from './sqlite-vault-database';

const TEST_CLOSED_AT = '2026-09-21T12:00:00.000Z';

interface TradeInput {
  readonly accountId?: string | null;
  readonly closedAt?: string;
  readonly direction?: 'long' | 'short' | null;
  readonly entryNote?: string | null;
  readonly id: string;
  readonly inputResultKind?: 'cash' | 'percent' | 'r';
  readonly inputResultValue?: string;
  readonly instrumentSymbol: string;
  readonly netResultUsd?: string;
  readonly reviewNote?: string | null;
  readonly tagIds?: readonly string[];
}

const createFixture = () => {
  const parentDirectory = mkdtempSync(join(tmpdir(), 'tjournal-'));
  const database = new SqliteVaultDatabase();
  const storage = new SqliteJournalStorage(database);
  storage.createVault(join(parentDirectory, 'journal'));
  const accounts = new SqliteAccountStore(database);
  const tags = new SqliteTagStore(database);
  const trades = new SqliteTradeStore(database);
  const reader = new SqliteJournalTableReader(database, trades);
  const instrumentStore = new SqliteInstrumentStore(database);

  accounts.createAccount({
    defaults: [],
    id: 'account-a',
    name: 'Alpha',
    openingBalanceUsd: '10000',
  });
  accounts.createAccount({
    defaults: [],
    id: 'account-b',
    name: 'Beta',
    openingBalanceUsd: '10000',
  });
  tags.createTag({ color: 'blue', description: '', id: 'tag-1', name: 'Setup', nameKey: 'setup' });

  const instruments = new Map(
    instrumentStore.listInstruments().map((instrument) => [instrument.symbol, instrument.id]),
  );
  const requireInstrument = (symbol: string): string => {
    const id = instruments.get(symbol);
    if (id === undefined) throw new Error(`Seed instrument ${symbol} is missing.`);
    return id;
  };

  const insertTrade = (input: TradeInput): void => {
    const accountId = input.accountId ?? null;
    trades.createTrade({
      account:
        accountId === null
          ? null
          : {
              accountId,
              accountName: accountId === 'account-a' ? 'Alpha' : 'Beta',
              balanceBeforeUsd: '1000',
              balanceImpactUsd: input.netResultUsd ?? null,
              conversion: 'cash',
              conversionBalanceUsd: null,
              initialRiskUsd: null,
            },
      closedAt: input.closedAt ?? TEST_CLOSED_AT,
      direction: input.direction ?? TRADE_DIRECTIONS.long,
      entryNote: input.entryNote ?? null,
      execution: null,
      id: input.id,
      ...(input.inputResultKind === undefined ? {} : { inputResultKind: input.inputResultKind }),
      ...(input.inputResultValue === undefined ? {} : { inputResultValue: input.inputResultValue }),
      instrumentId: requireInstrument(input.instrumentSymbol),
      ...(input.netResultUsd === undefined ? {} : { netResultUsd: input.netResultUsd }),
      resultKind: input.inputResultKind ?? TRADE_RESULT_KINDS.cash,
      resultSource: TRADE_RESULT_SOURCES.manual,
      resultValue: input.inputResultValue ?? input.netResultUsd ?? '0',
      reviewNote: input.reviewNote ?? null,
      reviewStatus: 'unreviewed',
      riskBindingSnapshot: null,
      tagIds: input.tagIds ?? [],
    });
  };

  const insertMovement = (input: {
    readonly accountId: string;
    readonly amountUsd: string;
    readonly id: string;
    readonly kind: 'deposit' | 'withdrawal';
    readonly occurredAt: string;
  }): void => {
    database
      .require()
      .prepare(
        'INSERT INTO cash_movements (id, account_id, account_name_snapshot, occurred_at, kind, amount_usd) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        input.id,
        input.accountId,
        input.accountId === 'account-a' ? 'Alpha' : 'Beta',
        input.occurredAt,
        input.kind,
        input.amountUsd,
      );
  };

  return {
    accounts,
    database,
    parentDirectory,
    insertMovement,
    insertTrade,
    instrumentStore,
    reader,
    storage,
    tags,
    trades,
    dispose: (): void => {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    },
  };
};

const emptyFilters = (): JournalTableFilters => ({
  accountIds: [],
  categories: [],
  closedFromDate: null,
  closedToDate: null,
  entryKinds: [],
  includeUntagged: false,
  includeUnassigned: false,
  instrumentIds: [],
  occurredFrom: null,
  occurredTo: null,
  resultBounds: null,
  resultUnits: [],
  tagIds: [],
  textQuery: null,
});

const createQuery = (
  overrides: Partial<JournalTableQuery> = {},
  filters: Partial<JournalTableFilters> = {},
): JournalTableQuery => ({
  cursor: null,
  filters: { ...emptyFilters(), ...filters },
  includeCashMovements: true,
  limit: 50,
  sort: { direction: 'desc', field: 'date' },
  ...overrides,
});

const idsOf = (rows: readonly JournalTableRow[]): readonly string[] => rows.map((row) => row.id);

describe('SqliteJournalTableReader', () => {
  it('paginates equal timestamps without gaps or duplicates', () => {
    const fixture = createFixture();
    try {
      const timestamps = [
        TEST_CLOSED_AT,
        TEST_CLOSED_AT,
        TEST_CLOSED_AT,
        '2026-09-20T09:00:00.000Z',
        '2026-09-19T09:00:00.000Z',
      ];
      timestamps.forEach((closedAt, index) =>
        fixture.insertTrade({ closedAt, id: `trade-${index}`, instrumentSymbol: 'EURUSD' }),
      );
      fixture.insertMovement({
        accountId: 'account-a',
        amountUsd: '10',
        id: 'movement-1',
        kind: 'deposit',
        occurredAt: TEST_CLOSED_AT,
      });
      fixture.insertMovement({
        accountId: 'account-b',
        amountUsd: '5',
        id: 'movement-2',
        kind: 'withdrawal',
        occurredAt: TEST_CLOSED_AT,
      });

      const all = fixture.reader.readPage(createQuery({ limit: 50 }));
      expect(idsOf(all.rows)).toHaveLength(7);
      const firstTrade = all.rows.find((row) => row.kind === 'trade');
      expect(firstTrade).toBeDefined();
      if (firstTrade?.kind === 'trade') expect('execution' in firstTrade.trade).toBe(false);
      expect(all.unassignedTradeCount).toBe(5);
      expect(all.totalEntryCount).toBe(7);

      const collected: JournalTableRow[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const page = fixture.reader.readPage(createQuery({ cursor, limit: 2 }));
        collected.push(...page.rows);
        cursor = page.nextCursor;
        pages += 1;
      } while (cursor !== null && pages < 10);

      expect(pages).toBe(4);
      expect(idsOf(collected)).toEqual(idsOf(all.rows));
      expect(new Set(idsOf(collected)).size).toBe(7);

      const firstPage = fixture.reader.readPage(createQuery({ limit: 2 }));
      const secondPage = fixture.reader.readPage(
        createQuery({ cursor: firstPage.nextCursor, limit: 2 }),
      );
      const thirdPage = fixture.reader.readPage(
        createQuery({ cursor: secondPage.nextCursor, limit: 2 }),
      );
      const returnedSecondPage = fixture.reader.readPage(
        createQuery({ cursor: thirdPage.previousCursor, limit: 2 }),
      );

      expect(idsOf(returnedSecondPage.rows)).toEqual(idsOf(secondPage.rows));
      expect(returnedSecondPage.previousCursor).not.toBeNull();
      expect(returnedSecondPage.nextCursor).not.toBeNull();
    } finally {
      fixture.dispose();
    }
  });

  it('keeps trade and movement row identities distinct when aggregate ids match', () => {
    const fixture = createFixture();
    try {
      fixture.insertTrade({ id: 'shared-id', instrumentSymbol: 'EURUSD' });
      fixture.insertMovement({
        accountId: 'account-a',
        amountUsd: '10',
        id: 'shared-id',
        kind: 'deposit',
        occurredAt: TEST_CLOSED_AT,
      });

      expect(idsOf(fixture.reader.readPage(createQuery()).rows)).toEqual([
        'trade:shared-id',
        'cash-movement:shared-id',
      ]);
    } finally {
      fixture.dispose();
    }
  });

  it('applies text, entry, account and unit filters with parity semantics', () => {
    const fixture = createFixture();
    try {
      fixture.insertTrade({
        accountId: 'account-a',
        id: 'aaaa-1111',
        instrumentSymbol: 'EURUSD',
        inputResultKind: 'percent',
        inputResultValue: '10',
        netResultUsd: '100',
      });
      fixture.insertTrade({
        accountId: 'account-b',
        direction: 'short',
        id: 'bbbb-2222',
        instrumentSymbol: 'BTCUSD',
        netResultUsd: '50',
      });
      fixture.insertTrade({ id: 'cccc-3333', instrumentSymbol: 'EURUSD', netResultUsd: '25' });
      fixture.insertMovement({
        accountId: 'account-a',
        amountUsd: '12',
        id: 'dddd-4444',
        kind: 'deposit',
        occurredAt: TEST_CLOSED_AT,
      });

      const text = fixture.reader.readPage(createQuery({}, { textQuery: 'BBBB' }));
      expect(idsOf(text.rows)).toEqual(['trade:bbbb-2222']);

      const entries = fixture.reader.readPage(
        createQuery({}, { entryKinds: ['short', 'deposit'] }),
      );
      expect(idsOf(entries.rows)).toEqual(['trade:bbbb-2222', 'cash-movement:dddd-4444']);

      const accounts = fixture.reader.readPage(createQuery({}, { accountIds: ['account-a'] }));
      expect(idsOf(accounts.rows)).toEqual(['trade:aaaa-1111', 'cash-movement:dddd-4444']);

      const unassigned = fixture.reader.readPage(createQuery({}, { includeUnassigned: true }));
      expect(idsOf(unassigned.rows)).toEqual(['trade:cccc-3333']);

      const percentOnly = fixture.reader.readPage(createQuery({}, { resultUnits: ['percent'] }));
      expect(idsOf(percentOnly.rows)).toEqual(['trade:aaaa-1111']);

      const asset = fixture.reader.readPage(
        createQuery({}, { instrumentIds: [requireSymbol(fixture, 'BTCUSD')] }),
      );
      expect(idsOf(asset.rows)).toEqual(['trade:bbbb-2222']);

      const category = fixture.reader.readPage(createQuery({}, { categories: ['crypto'] }));
      expect(idsOf(category.rows)).toEqual(['trade:bbbb-2222']);

      const noMovements = fixture.reader.readPage(
        createQuery({ includeCashMovements: false }, { entryKinds: ['deposit'] }),
      );
      expect(idsOf(noMovements.rows)).toEqual([]);
    } finally {
      fixture.dispose();
    }
  });

  it('searches both notes with Unicode case-insensitive matching without returning note contents', () => {
    const fixture = createFixture();
    try {
      fixture.insertTrade({
        entryNote: 'Отбой от уровня после ретеста',
        id: 'note-entry-trade',
        instrumentSymbol: 'EURUSD',
      });
      fixture.insertTrade({
        id: 'note-review-trade',
        instrumentSymbol: 'EURUSD',
        reviewNote: 'Не дождался подтверждения сигнала',
      });

      const entryMatches = fixture.reader.readPage(createQuery({}, { textQuery: 'ОТБОЙ' }));
      const reviewMatches = fixture.reader.readPage(
        createQuery({}, { textQuery: 'ПОДТВЕРЖДЕНИЯ' }),
      );

      expect(idsOf(entryMatches.rows)).toEqual(['trade:note-entry-trade']);
      expect(idsOf(reviewMatches.rows)).toEqual(['trade:note-review-trade']);
      const entryRow = entryMatches.rows[0];
      if (entryRow?.kind !== 'trade') throw new Error('Expected a trade row.');
      expect(Object.hasOwn(entryRow.trade, 'entryNote')).toBe(false);
      expect(Object.hasOwn(entryRow.trade, 'reviewNote')).toBe(false);
    } finally {
      fixture.dispose();
    }
  });

  it('compares result bounds with exact decimal semantics', () => {
    const fixture = createFixture();
    try {
      fixture.insertTrade({ id: 'trade-01', instrumentSymbol: 'EURUSD', netResultUsd: '0.1' });
      fixture.insertTrade({ id: 'trade-02', instrumentSymbol: 'EURUSD', netResultUsd: '0.2' });
      fixture.insertTrade({ id: 'trade-03', instrumentSymbol: 'EURUSD', netResultUsd: '0.3' });
      fixture.insertTrade({
        id: 'trade-04',
        instrumentSymbol: 'EURUSD',
        netResultUsd: '0.30000000000000004',
      });
      fixture.insertTrade({ id: 'trade-05', instrumentSymbol: 'EURUSD' });
      fixture.insertMovement({
        accountId: 'account-a',
        amountUsd: '2',
        id: 'withdrawal',
        kind: 'withdrawal',
        occurredAt: TEST_CLOSED_AT,
      });

      const between = fixture.reader.readPage(
        createQuery(
          {},
          {
            resultBounds: { maximum: '0.2', minimum: '0.1', mode: 'between' },
          },
        ),
      );
      expect(idsOf(between.rows)).toEqual(['trade:trade-02', 'trade:trade-01']);

      const greater = fixture.reader.readPage(
        createQuery(
          {},
          {
            resultBounds: { maximum: null, minimum: '0.2', mode: 'greaterThan' },
          },
        ),
      );
      expect(idsOf(greater.rows)).toEqual(['trade:trade-04', 'trade:trade-03']);

      // A REAL comparison would treat 0.30000000000000004 and 0.3 as equal.
      const equals = fixture.reader.readPage(
        createQuery(
          {},
          {
            resultBounds: { maximum: null, minimum: '0.3', mode: 'equals' },
          },
        ),
      );
      expect(idsOf(equals.rows)).toEqual(['trade:trade-03']);

      const movements = fixture.reader.readPage(
        createQuery(
          {},
          {
            resultBounds: { maximum: '0', minimum: null, mode: 'lessThan' },
          },
        ),
      );
      expect(idsOf(movements.rows)).toEqual(['cash-movement:withdrawal']);
    } finally {
      fixture.dispose();
    }
  });

  it('filters by tags, including the untagged option', () => {
    const fixture = createFixture();
    try {
      fixture.tags.createTag({
        color: 'rose',
        description: '',
        id: 'tag-2',
        name: 'Other',
        nameKey: 'other',
      });
      fixture.insertTrade({
        id: 'tagged',
        instrumentSymbol: 'EURUSD',
        tagIds: ['tag-1'],
      });
      fixture.insertTrade({
        id: 'other-tag',
        instrumentSymbol: 'EURUSD',
        tagIds: ['tag-2'],
      });
      fixture.insertTrade({ id: 'untagged', instrumentSymbol: 'EURUSD' });
      fixture.insertMovement({
        accountId: 'account-a',
        amountUsd: '3',
        id: 'movement',
        kind: 'deposit',
        occurredAt: TEST_CLOSED_AT,
      });

      const tagged = fixture.reader.readPage(createQuery({}, { tagIds: ['tag-1'] }));
      expect(idsOf(tagged.rows)).toEqual(['trade:tagged']);

      const untagged = fixture.reader.readPage(createQuery({}, { includeUntagged: true }));
      expect(idsOf(untagged.rows)).toEqual(['trade:untagged', 'cash-movement:movement']);

      const combined = fixture.reader.readPage(
        createQuery({}, { includeUntagged: true, tagIds: ['tag-1'] }),
      );
      expect(idsOf(combined.rows)).toEqual([
        'trade:untagged',
        'trade:tagged',
        'cash-movement:movement',
      ]);
    } finally {
      fixture.dispose();
    }
  });

  it('registers the exact decimal comparator for every activated vault connection', () => {
    const fixture = createFixture();
    try {
      fixture.insertTrade({ id: 'vault-a-trade', instrumentSymbol: 'EURUSD', netResultUsd: '1' });
      expect(
        idsOf(
          fixture.reader.readPage(
            createQuery({}, { resultBounds: { maximum: null, minimum: '0', mode: 'greaterThan' } }),
          ).rows,
        ),
      ).toEqual(['trade:vault-a-trade']);

      fixture.storage.createVault(join(fixture.parentDirectory, 'journal-b'));
      const instrument = fixture.instrumentStore
        .listInstruments()
        .find((item) => item.symbol === 'EURUSD');
      if (instrument === undefined) throw new Error('Seed instrument EURUSD is missing.');
      fixture.trades.createTrade({
        closedAt: TEST_CLOSED_AT,
        direction: TRADE_DIRECTIONS.long,
        entryNote: null,
        execution: null,
        id: 'vault-b-trade',
        instrumentId: instrument.id,
        netResultUsd: '2',
        resultKind: TRADE_RESULT_KINDS.cash,
        resultSource: TRADE_RESULT_SOURCES.manual,
        resultValue: '2',
        reviewNote: null,
        reviewStatus: 'unreviewed',
        riskBindingSnapshot: null,
        tagIds: [],
      });

      expect(
        idsOf(
          fixture.reader.readPage(
            createQuery({}, { resultBounds: { maximum: null, minimum: '0', mode: 'greaterThan' } }),
          ).rows,
        ),
      ).toEqual(['trade:vault-b-trade']);
    } finally {
      fixture.dispose();
    }
  });

  it('applies date and instant ranges inclusively', () => {
    const fixture = createFixture();
    try {
      fixture.insertTrade({
        closedAt: '2026-09-18T23:30:00.000Z',
        id: 'before',
        instrumentSymbol: 'EURUSD',
      });
      fixture.insertTrade({
        closedAt: '2026-09-19T00:30:00.000Z',
        id: 'inside',
        instrumentSymbol: 'EURUSD',
      });
      fixture.insertTrade({
        closedAt: '2026-09-19T23:30:00.000Z',
        id: 'late',
        instrumentSymbol: 'EURUSD',
      });

      const day = fixture.reader.readPage(
        createQuery({}, { closedFromDate: '2026-09-19', closedToDate: '2026-09-19' }),
      );
      expect(idsOf(day.rows)).toEqual(['trade:late', 'trade:inside']);

      const instant = fixture.reader.readPage(
        createQuery(
          {},
          { occurredFrom: '2026-09-19T00:00:00.000Z', occurredTo: '2026-09-19T23:00:00.000Z' },
        ),
      );
      expect(idsOf(instant.rows)).toEqual(['trade:inside']);
    } finally {
      fixture.dispose();
    }
  });

  it('sorts by the allowlisted fields with nulls last', () => {
    const fixture = createFixture();
    try {
      fixture.insertTrade({
        accountId: 'account-b',
        id: 'beta',
        instrumentSymbol: 'BTCUSD',
        netResultUsd: '5',
      });
      fixture.insertTrade({
        accountId: 'account-a',
        id: 'alpha',
        instrumentSymbol: 'EURUSD',
        netResultUsd: '50',
      });
      fixture.insertTrade({ id: 'legacy', instrumentSymbol: 'EURUSD' });

      const byResult = fixture.reader.readPage(
        createQuery({ sort: { direction: 'desc', field: 'result' } }),
      );
      expect(idsOf(byResult.rows)).toEqual(['trade:alpha', 'trade:beta', 'trade:legacy']);

      const byAsset = fixture.reader.readPage(
        createQuery({ sort: { direction: 'asc', field: 'asset' } }),
      );
      expect(idsOf(byAsset.rows)).toEqual(['trade:beta', 'trade:alpha', 'trade:legacy']);

      const byAccount = fixture.reader.readPage(
        createQuery({ sort: { direction: 'asc', field: 'account' } }),
      );
      expect(idsOf(byAccount.rows)).toEqual(['trade:alpha', 'trade:beta', 'trade:legacy']);
    } finally {
      fixture.dispose();
    }
  });

  it('rejects an invalid cursor or page size', () => {
    const fixture = createFixture();
    try {
      fixture.insertTrade({ id: 'trade-1', instrumentSymbol: 'EURUSD' });

      let caught: unknown = null;
      try {
        fixture.reader.readPage(createQuery({ cursor: 'not-a-cursor' }));
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(AppError);
      if (caught instanceof AppError) expect(caught.code).toBe('validation-invalid');

      const page = fixture.reader.readPage(createQuery({ limit: 1 }));
      expect(page.nextCursor).not.toBeNull();
      const tampered = Buffer.from(
        JSON.stringify({ direction: 'asc', field: 'result', v: 1, values: [0, '1', 'x', 'y'] }),
        'utf8',
      ).toString('base64url');
      expect(() => fixture.reader.readPage(createQuery({ cursor: tampered, limit: 1 }))).toThrow(
        AppError,
      );
      expect(() => fixture.reader.readPage(createQuery({ limit: 1000 }))).toThrow(AppError);
    } finally {
      fixture.dispose();
    }
  });
});

const requireSymbol = (fixture: ReturnType<typeof createFixture>, symbol: string): string => {
  const instrument = fixture.instrumentStore
    .listInstruments()
    .find((item) => item.symbol === symbol);
  if (instrument === undefined) throw new Error(`Seed instrument ${symbol} is missing.`);
  return instrument.id;
};
