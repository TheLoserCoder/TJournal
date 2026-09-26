// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { calculateTradeSummary, summarizeTradeFacts } from '@tjournal/analytics';

import { SqliteAccountStore } from './sqlite-account-store';
import { SqliteInstrumentStore } from './sqlite-instrument-store';
import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteJournalTableReader } from './sqlite-journal-table-reader';
import { SqliteTradeStore } from './sqlite-trade-store';
import { SqliteTradeSummaryFactSource } from './sqlite-trade-summary-fact-source';
import { SqliteVaultDatabase } from './sqlite-vault-database';
import { countDatabaseQueries } from './testing/query-counter';

const TRADE_COUNT = 5_000;
const EXECUTION_EVERY = 10;
const ACCOUNT_COUNT = 100;
const TEST_CLOSED_AT = '2026-09-21T12:00:00.000Z';

interface BenchmarkMeasurement {
  readonly durationMs: number;
  readonly name: string;
  readonly queries: number;
}

const insertRows = (
  database: SqliteVaultDatabase,
  sql: string,
  rows: readonly (readonly (string | null)[])[],
): void => {
  const prepared = database.require().prepare(sql);
  database.transaction(() => {
    rows.forEach((row) => prepared.run(...row));
  });
};

const buildFixture = (parentDirectory: string): SqliteVaultDatabase => {
  const database = new SqliteVaultDatabase();
  const storage = new SqliteJournalStorage(database);
  storage.createVault(join(parentDirectory, 'journal'));
  const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
  if (instrument === undefined) throw new Error('Seed instrument is missing.');

  const accountRows: (readonly (string | null)[])[] = [];
  for (let index = 0; index < ACCOUNT_COUNT; index += 1) {
    accountRows.push([
      `benchmark-account-${index}`,
      `Benchmark account ${index}`,
      '1000',
      TEST_CLOSED_AT,
      TEST_CLOSED_AT,
      null,
      null,
    ]);
  }
  insertRows(
    database,
    'INSERT INTO accounts (id, name, opening_balance_usd, created_at, updated_at, archived_at, default_risk_usd) VALUES (?, ?, ?, ?, ?, ?, ?)',
    accountRows,
  );

  const tradeRows: (readonly (string | null)[])[] = [];
  for (let index = 0; index < TRADE_COUNT; index += 1) {
    const hasExecution = index % EXECUTION_EVERY === 0;
    const hasAccount = index % 2 === 0;
    const accountId = hasAccount ? `benchmark-account-${index % ACCOUNT_COUNT}` : null;
    tradeRows.push([
      `benchmark-trade-${index}`,
      instrument.symbol,
      instrument.id,
      TEST_CLOSED_AT,
      'long',
      'cash',
      '10',
      'manual',
      'cash',
      '10',
      '10',
      hasExecution ? '100' : null,
      hasExecution ? '1' : null,
      hasExecution ? '0' : null,
      hasExecution ? '0' : null,
      hasExecution ? '0.5' : null,
      hasExecution ? '10' : null,
      accountId,
      accountId === null ? null : `Benchmark account ${index % ACCOUNT_COUNT}`,
      accountId === null ? null : '1000',
      accountId === null ? null : '1.5',
    ]);
  }
  insertRows(
    database,
    `INSERT INTO trades (id, instrument, instrument_id, closed_at, direction, result_kind, result_value, result_source, input_result_kind, input_result_value, net_result_usd, entry_price, quantity_lots, commission_usd, spread_ticks, snapshot_tick_size, snapshot_tick_value_usd_per_lot, account_id, account_name_snapshot, account_balance_before_usd, account_balance_impact_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    tradeRows,
  );

  const exitRows: (readonly (string | null)[])[] = [];
  for (let index = 0; index < TRADE_COUNT; index += EXECUTION_EVERY) {
    for (let exitOrder = 0; exitOrder < 2; exitOrder += 1) {
      exitRows.push([
        `benchmark-exit-${index}-${exitOrder}`,
        `benchmark-trade-${index}`,
        String(exitOrder),
        '101',
        'percent',
        '50',
        null,
        null,
      ]);
    }
  }
  insertRows(
    database,
    'INSERT INTO trade_exits (id, trade_id, exit_order, exit_price, allocation_kind, allocation_value, reported_result_kind, reported_result_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    exitRows,
  );
  return database;
};

describe('query benchmark', () => {
  it('measures the journal read paths', () => {
    const parentDirectory = mkdtempSync(join(tmpdir(), 'tjournal-benchmark-'));
    const database = buildFixture(parentDirectory);
    const trades = new SqliteTradeStore(database);
    const accounts = new SqliteAccountStore(database);
    const reader = new SqliteJournalTableReader(database, trades);
    const counter = countDatabaseQueries(database);
    const measurements: BenchmarkMeasurement[] = [];

    const measure = (name: string, operation: () => void): void => {
      counter.reset();
      const startedAt = performance.now();
      operation();
      measurements.push({
        durationMs: performance.now() - startedAt,
        name,
        queries: counter.count(),
      });
    };

    try {
      measure('listTrades (5k, 10% executions)', () => {
        if (trades.listTrades().length !== TRADE_COUNT) throw new Error('Fixture mismatch.');
      });
      measure('listAccounts (100 accounts)', () => {
        if (accounts.listAccounts().length !== ACCOUNT_COUNT) throw new Error('Fixture mismatch.');
      });
      measure('getTradeById (5k journal)', () => {
        if (trades.getTradeById('benchmark-trade-4999') === null) {
          throw new Error('Fixture mismatch.');
        }
      });
      measure('readPage limit 100 (5k journal)', () => {
        const page = reader.readPage({
          cursor: null,
          filters: {
            accountIds: [],
            categories: [],
            closedFromDate: null,
            closedToDate: null,
            detailBounds: null,
            entryKinds: [],
            includeUntagged: false,
            includeUnassigned: false,
            instrumentIds: [],
            notePresence: [],
            occurredFrom: null,
            occurredTo: null,
            resultBounds: null,
            resultUnits: [],
            reviewStatuses: [],
            tagIds: [],
            textQuery: null,
          },
          includeCashMovements: true,
          limit: 100,
          sort: { direction: 'desc', field: 'date' },
        });
        if (page.rows.length !== 100 || page.nextCursor === null) {
          throw new Error('Fixture mismatch.');
        }
      });
      const summaryQuery = {
        filters: null,
        metric: 'cash',
        neutralCostSettings: { includeCommission: false, includeSpread: false },
        neutralRange: null,
        now: new Date(TEST_CLOSED_AT),
        period: 'all',
      } as const;

      measure('quick summary (5k journal, full list)', () => {
        const summary = calculateTradeSummary(trades.listTrades(), summaryQuery);
        if (summary.totalTrades !== TRADE_COUNT) throw new Error('Fixture mismatch.');
      });
      measure('quick summary (5k journal, streamed facts)', () => {
        const summary = summarizeTradeFacts(
          new SqliteTradeSummaryFactSource(database).scanSummaryFacts(),
          summaryQuery,
        );
        if (summary.totalTrades !== TRADE_COUNT) throw new Error('Fixture mismatch.');
      });

      // Deterministic retained-payload proxy: the summary result is orders of
      // magnitude smaller than the materialised list it was built from.
      const fullListPayloadBytes = Buffer.byteLength(JSON.stringify(trades.listTrades()));
      const summaryPayloadBytes = Buffer.byteLength(
        JSON.stringify(
          summarizeTradeFacts(
            new SqliteTradeSummaryFactSource(database).scanSummaryFacts(),
            summaryQuery,
          ),
        ),
      );
      console.log(
        `[query-benchmark] retained payload bytes (5k): listTrades ${fullListPayloadBytes}, summary ${summaryPayloadBytes}`,
      );

      // Best-effort retained heap. Each payload is produced and consumed inside
      // one call, so the two measurements stay isolated from each other.
      // `--expose-gc` is enabled in vitest.config.ts; without it these lines are
      // skipped and only the payload gate above remains.
      const measureRetainedHeap = <T>(
        name: string,
        produce: () => T,
        describe: (value: T) => string,
      ): void => {
        const gc = (globalThis as { gc?: () => void }).gc;
        if (gc === undefined) return;
        gc();
        const before = process.memoryUsage().heapUsed;
        const value = produce();
        // Collect the operation's garbage before reading, while `value` stays
        // reachable through `describe`, so the delta is retained size and not
        // transient allocation.
        gc();
        const after = process.memoryUsage().heapUsed;
        console.log(
          `[query-benchmark] ${name}: retained ${((after - before) / 1_048_576).toFixed(2)} MiB (${describe(value)})`,
        );
      };
      measureRetainedHeap(
        'listTrades retained heap (5k)',
        () => trades.listTrades(),
        (list) => `rows ${list.length}`,
      );
      measureRetainedHeap(
        'streamed summary retained heap (5k)',
        () =>
          summarizeTradeFacts(
            new SqliteTradeSummaryFactSource(database).scanSummaryFacts(),
            summaryQuery,
          ),
        (summary) => `covered ${summary.coveredTrades}`,
      );

      measurements.forEach((measurement) => {
        console.log(
          `[query-benchmark] ${measurement.name}: ${measurement.durationMs.toFixed(1)} ms, ${measurement.queries} prepared statements`,
        );
      });
      expect(measurements).toHaveLength(6);
      // The streamed summary is one iterated statement; the full-list summary
      // also loads exits and tags for every trade.
      expect(
        measurements.find((measurement) => measurement.name.includes('streamed facts'))?.queries,
      ).toBe(1);
      expect(
        measurements.find((measurement) => measurement.name.includes('full list'))?.queries,
      ).toBe(3);
      // Deterministic memory gate: the retained summary payload is tiny next to
      // the materialised list. Peak heap itself stays informational because it
      // depends on the collector.
      expect(summaryPayloadBytes * 100).toBeLessThan(fullListPayloadBytes);
    } finally {
      counter.restore();
      database.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });
});
