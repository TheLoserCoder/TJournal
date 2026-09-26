// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ClosedTrade, RiskBindingSnapshot } from '@tjournal/trade';
import { TRADE_RESULT_SOURCES } from '@tjournal/trade';
import { describe, expect, it } from 'vitest';

import { SqliteInstrumentStore } from './sqlite-instrument-store';
import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteTradeStore } from './sqlite-trade-store';
import { SqliteVaultDatabase } from './sqlite-vault-database';
import { countDatabaseQueries } from './testing/query-counter';

const TEST_CLOSED_AT = '2026-09-21T12:00:00.000Z';
// The scale scenario creates and rewrites hundreds of rows synchronously; a
// cold CI runner needs more than the default 5s test timeout.
const LARGE_JOURNAL_TEST_TIMEOUT_MS = 30_000;

const riskBound = (value: string): RiskBindingSnapshot => ({
  kind: 'cash',
  source: 'vault-default',
  value,
});

const createR = (
  trades: SqliteTradeStore,
  instrumentId: string,
  id: string,
  binding: RiskBindingSnapshot | null,
): ClosedTrade =>
  trades.createTrade({
    closedAt: TEST_CLOSED_AT,
    direction: 'long',
    entryNote: null,
    execution: null,
    id,
    instrumentId,
    resultKind: 'r',
    resultSource: TRADE_RESULT_SOURCES.manual,
    resultValue: '2',
    reviewNote: null,
    reviewStatus: 'unreviewed',
    riskBindingSnapshot: binding,
    tagIds: [],
  });

const createCash = (trades: SqliteTradeStore, instrumentId: string, id: string): ClosedTrade =>
  trades.createTrade({
    closedAt: TEST_CLOSED_AT,
    direction: 'long',
    entryNote: null,
    execution: null,
    id,
    instrumentId,
    netResultUsd: '10',
    resultKind: 'cash',
    resultSource: TRADE_RESULT_SOURCES.manual,
    resultValue: '10',
    reviewNote: null,
    reviewStatus: 'unreviewed',
    riskBindingSnapshot: null,
    tagIds: [],
  });

const withVault = (
  run: (context: {
    readonly database: SqliteVaultDatabase;
    readonly instrumentId: string;
    readonly trades: SqliteTradeStore;
  }) => void,
): void => {
  const parent = mkdtempSync(join(tmpdir(), 'tjournal-prefs-'));
  const database = new SqliteVaultDatabase();
  try {
    new SqliteJournalStorage(database).createVault(join(parent, 'journal'));
    const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
    if (instrument === undefined) throw new Error('Seed instrument is missing.');
    run({ database, instrumentId: instrument.id, trades: new SqliteTradeStore(database) });
  } finally {
    database.close();
    rmSync(parent, { force: true, recursive: true });
  }
};

describe('SQLite trade preference rebinding', () => {
  it('snapshots only the rewritten bindings and restores them without touching later edits', () => {
    withVault(({ instrumentId, trades }) => {
      createR(trades, instrumentId, 'r-bound', riskBound('100'));
      createR(trades, instrumentId, 'r-unbound', null);
      createCash(trades, instrumentId, 'cash-1');

      const base = trades.getTradePreferences();

      const preferenceOnly = trades.saveTradePreferences(
        { ...base, riskBinding: riskBound('100') },
        false,
      );
      expect(preferenceOnly.reboundRiskBindings).toEqual([]);
      expect(trades.getTradeById('r-unbound')?.riskBindingSnapshot).toBeNull();

      const rebound = trades.saveTradePreferences({ ...base, riskBinding: riskBound('200') }, true);
      expect(rebound.reboundRiskBindings).toEqual([
        { riskBindingSnapshot: riskBound('100'), tradeId: 'r-bound' },
        { riskBindingSnapshot: null, tradeId: 'r-unbound' },
      ]);
      expect(trades.getTradeById('r-bound')?.riskBindingSnapshot).toEqual(riskBound('200'));
      expect(trades.getTradeById('r-unbound')?.riskBindingSnapshot).toEqual(riskBound('200'));
      expect(trades.getTradeById('cash-1')?.riskBindingSnapshot).toBeNull();

      const unbound = trades.getTradeById('r-unbound');
      if (unbound === null) throw new Error('Trade is missing.');
      trades.updateTrade({ ...unbound, entryNote: 'later edit' });

      trades.restoreTradePreferences(base, rebound.reboundRiskBindings);

      const reverted = trades.getTradeById('r-unbound');
      expect(reverted?.riskBindingSnapshot).toBeNull();
      expect(reverted?.entryNote).toBe('later edit');
      expect(trades.getTradeById('r-bound')?.riskBindingSnapshot).toEqual(riskBound('100'));
    });
  });

  it(
    'bounds the snapshot and inverse by the affected rows on a large journal',
    () => {
      withVault(({ database, instrumentId, trades }) => {
        const UNBOUND_COUNT = 300;
        const DEFAULT_BOUND_COUNT = 50;
        const OTHER_BOUND_COUNT = 20;
        const CASH_COUNT = 30;
        for (let index = 0; index < UNBOUND_COUNT; index += 1) {
          createR(trades, instrumentId, `r-unbound-${index}`, null);
        }
        for (let index = 0; index < DEFAULT_BOUND_COUNT; index += 1) {
          createR(trades, instrumentId, `r-default-${index}`, riskBound('100'));
        }
        for (let index = 0; index < OTHER_BOUND_COUNT; index += 1) {
          createR(trades, instrumentId, `r-other-${index}`, riskBound('999'));
        }
        for (let index = 0; index < CASH_COUNT; index += 1) {
          createCash(trades, instrumentId, `cash-${index}`);
        }

        const counter = countDatabaseQueries(database);
        try {
          const base = trades.getTradePreferences();

          counter.reset();
          const preferenceOnly = trades.saveTradePreferences(
            { ...base, riskBinding: riskBound('100') },
            false,
          );
          // A preference-only change reads and writes the preference row and never
          // touches trades.
          expect(counter.count()).toBe(2);
          expect(preferenceOnly.reboundRiskBindings).toEqual([]);

          counter.reset();
          const saved = trades.saveTradePreferences(
            { ...base, riskBinding: riskBound('200') },
            true,
          );
          // Preferences read, preference write, affected binding capture and one
          // affected binding update, independent of how many rows matched.
          expect(counter.count()).toBe(4);
          expect(saved.reboundRiskBindings).toHaveLength(UNBOUND_COUNT + DEFAULT_BOUND_COUNT);
          console.log(
            `[preferences] rebound snapshot: ${saved.reboundRiskBindings.length} rows, ${Buffer.byteLength(JSON.stringify(saved.reboundRiskBindings))} payload bytes`,
          );

          expect(trades.getTradeById('r-unbound-0')?.riskBindingSnapshot).toEqual(riskBound('200'));
          expect(trades.getTradeById('r-default-0')?.riskBindingSnapshot).toEqual(riskBound('200'));
          expect(trades.getTradeById('r-other-0')?.riskBindingSnapshot).toEqual(riskBound('999'));
          expect(trades.getTradeById('cash-0')?.riskBindingSnapshot).toBeNull();

          counter.reset();
          trades.restoreTradePreferences(base, saved.reboundRiskBindings);
          // One preference write plus one reused binding statement, not one
          // statement per affected trade.
          expect(counter.count()).toBe(2);

          expect(trades.getTradeById('r-unbound-0')?.riskBindingSnapshot).toBeNull();
          expect(trades.getTradeById('r-default-0')?.riskBindingSnapshot).toEqual(riskBound('100'));
          expect(trades.getTradeById('r-other-0')?.riskBindingSnapshot).toEqual(riskBound('999'));
        } finally {
          counter.restore();
        }
      });
    },
    LARGE_JOURNAL_TEST_TIMEOUT_MS,
  );
});
