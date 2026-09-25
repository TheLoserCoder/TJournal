// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { JournalTableFilters, JournalTableQuery } from '@tjournal/trade';

import { SqliteAccountStore } from './sqlite-account-store';
import { SqliteInstrumentStore } from './sqlite-instrument-store';
import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteJournalTableReader } from './sqlite-journal-table-reader';
import { SqliteTradeStore } from './sqlite-trade-store';
import { SqliteVaultDatabase } from './sqlite-vault-database';
import { countDatabaseQueries } from './testing/query-counter';

const TEST_CLOSED_AT = '2026-09-21T12:00:00.000Z';
const EXECUTION_EVERY = 2;

const EMPTY_JOURNAL_FILTERS: JournalTableFilters = {
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
};

const createPageQuery = (): JournalTableQuery => ({
  cursor: null,
  filters: EMPTY_JOURNAL_FILTERS,
  includeCashMovements: true,
  limit: 10,
  sort: { direction: 'desc', field: 'date' },
});

interface IdRange {
  readonly from: number;
  readonly to: number;
}

const insertTrades = (
  database: SqliteVaultDatabase,
  instrument: { readonly id: string; readonly symbol: string },
  range: IdRange,
): void => {
  const prepared = database.require().prepare(
    `INSERT INTO trades (id, instrument, instrument_id, closed_at, direction, result_kind, result_value, result_source, input_result_kind, input_result_value, net_result_usd, entry_price, quantity_lots, commission_usd, spread_ticks, snapshot_tick_size, snapshot_tick_value_usd_per_lot)
       VALUES (?, ?, ?, ?, 'long', 'cash', '10', 'manual', 'cash', '10', '10', ?, ?, ?, ?, ?, ?)`,
  );
  const insertExit = database.require().prepare(
    `INSERT INTO trade_exits (id, trade_id, exit_order, exit_price, allocation_kind, allocation_value, reported_result_kind, reported_result_value)
       VALUES (?, ?, ?, '101', 'percent', '50', NULL, NULL)`,
  );
  database.transaction(() => {
    for (let index = range.from; index < range.to; index += 1) {
      const hasExecution = index % EXECUTION_EVERY === 0;
      prepared.run(
        `trade-${index}`,
        instrument.symbol,
        instrument.id,
        TEST_CLOSED_AT,
        hasExecution ? '100' : null,
        hasExecution ? '1' : null,
        hasExecution ? '0' : null,
        hasExecution ? '0' : null,
        hasExecution ? '0.5' : null,
        hasExecution ? '10' : null,
      );
      if (hasExecution) {
        insertExit.run(`exit-${index}-0`, `trade-${index}`, 0);
        insertExit.run(`exit-${index}-1`, `trade-${index}`, 1);
      }
    }
  });
};

const insertAccounts = (
  database: SqliteVaultDatabase,
  range: IdRange,
  linkedTrades: number,
): void => {
  const prepared = database.require().prepare(
    `INSERT INTO accounts (id, name, opening_balance_usd, created_at, updated_at, archived_at, default_risk_usd)
       VALUES (?, ?, '1000', ?, ?, NULL, NULL)`,
  );
  const movement = database.require().prepare(
    `INSERT INTO cash_movements (id, account_id, account_name_snapshot, occurred_at, kind, amount_usd)
       VALUES (?, ?, ?, ?, 'deposit', '5')`,
  );
  const linkTrade = database
    .require()
    .prepare('UPDATE trades SET account_id = ?, account_name_snapshot = ? WHERE id = ?');
  database.transaction(() => {
    for (let index = range.from; index < range.to; index += 1) {
      prepared.run(`account-${index}`, `Account ${index}`, TEST_CLOSED_AT, TEST_CLOSED_AT);
      movement.run(`movement-${index}`, `account-${index}`, `Account ${index}`, TEST_CLOSED_AT);
      if (index < linkedTrades) {
        linkTrade.run(`account-${index}`, `Account ${index}`, `trade-${index}`);
      }
    }
  });
};

describe('bounded read query counts', () => {
  it('keeps trade list queries independent of the journal size', () => {
    const parentDirectory = mkdtempSync(join(tmpdir(), 'tjournal-'));
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const trades = new SqliteTradeStore(database);
    const counter = countDatabaseQueries(database);

    try {
      storage.createVault(join(parentDirectory, 'journal'));
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      insertTrades(database, instrument, { from: 0, to: 12 });

      counter.reset();
      expect(trades.listTrades()).toHaveLength(12);
      const initialCount = counter.count();

      insertTrades(database, instrument, { from: 12, to: 62 });
      counter.reset();
      expect(trades.listTrades()).toHaveLength(62);
      const grownCount = counter.count();

      expect(initialCount).toBe(3);
      expect(grownCount).toBe(initialCount);
    } finally {
      counter.restore();
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('keeps account projection queries independent of the account count', () => {
    const parentDirectory = mkdtempSync(join(tmpdir(), 'tjournal-'));
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const accounts = new SqliteAccountStore(database);
    const counter = countDatabaseQueries(database);

    try {
      storage.createVault(join(parentDirectory, 'journal'));
      insertAccounts(database, { from: 0, to: 5 }, 5);

      counter.reset();
      expect(accounts.listAccounts()).toHaveLength(5);
      const initialCount = counter.count();

      insertAccounts(database, { from: 5, to: 40 }, 5);
      counter.reset();
      expect(accounts.listAccounts()).toHaveLength(40);
      const grownCount = counter.count();

      expect(initialCount).toBe(5);
      expect(grownCount).toBe(initialCount);
    } finally {
      counter.restore();
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('loads one trade without scanning the journal', () => {
    const parentDirectory = mkdtempSync(join(tmpdir(), 'tjournal-'));
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const trades = new SqliteTradeStore(database);
    const counter = countDatabaseQueries(database);

    try {
      storage.createVault(join(parentDirectory, 'journal'));
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      insertTrades(database, instrument, { from: 0, to: 60 });

      counter.reset();
      expect(trades.getTradeById('trade-58')?.id).toBe('trade-58');
      expect(counter.count()).toBeLessThanOrEqual(3);

      counter.reset();
      expect(trades.getTradeById('missing')).toBeNull();
      expect(counter.count()).toBe(1);
    } finally {
      counter.restore();
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('bounds journal page reads independently of journal size', () => {
    const parentDirectory = mkdtempSync(join(tmpdir(), 'tjournal-'));
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const trades = new SqliteTradeStore(database);
    const reader = new SqliteJournalTableReader(database, trades);
    const counter = countDatabaseQueries(database);

    try {
      storage.createVault(join(parentDirectory, 'journal'));
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      insertTrades(database, instrument, { from: 0, to: 30 });

      counter.reset();
      const firstPage = reader.readPage(createPageQuery());
      const firstCount = counter.count();

      insertTrades(database, instrument, { from: 30, to: 120 });
      counter.reset();
      const grownPage = reader.readPage(createPageQuery());
      const grownCount = counter.count();

      expect(firstPage.rows).toHaveLength(10);
      expect(firstPage.nextCursor).not.toBeNull();
      expect(grownPage.rows).toHaveLength(10);
      expect(grownCount).toBe(firstCount);
      expect(grownCount).toBe(5);
    } finally {
      counter.restore();
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });
});
