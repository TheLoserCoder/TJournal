// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { TRADE_REVIEW_STATUSES, TRADE_RESULT_SOURCES } from '@tjournal/trade';

import { SqliteInstrumentStore } from './sqlite-instrument-store';
import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteTradeStore } from './sqlite-trade-store';
import { SqliteVaultDatabase } from './sqlite-vault-database';

const LEGACY_TRADE_MIGRATION_ID = '009-trade-notes-and-review';
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { force: true, recursive: true });
});

describe('trade notes migration', () => {
  it('keeps legacy trades and defaults their notes and review status', () => {
    const parent = mkdtempSync(join(tmpdir(), 'tjournal-trade-notes-'));
    directories.push(parent);
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const trades = new SqliteTradeStore(database);

    try {
      storage.createVault(join(parent, 'vault'));
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      trades.createTrade({
        closedAt: '2026-09-22T12:00:00.000Z',
        direction: 'long',
        entryNote: null,
        execution: null,
        id: 'legacy-trade',
        instrumentId: instrument.id,
        netResultUsd: '25',
        resultKind: 'cash',
        resultSource: TRADE_RESULT_SOURCES.manual,
        resultValue: '25',
        reviewNote: null,
        reviewStatus: TRADE_REVIEW_STATUSES.unreviewed,
        riskBindingSnapshot: null,
        tagIds: [],
      });

      database.require().exec(`
        ALTER TABLE trades DROP COLUMN entry_note;
        ALTER TABLE trades DROP COLUMN review_note;
        ALTER TABLE trades DROP COLUMN review_status;
      `);
      database
        .require()
        .prepare('DELETE FROM tjournal_migrations WHERE id = ?')
        .run(LEGACY_TRADE_MIGRATION_ID);
      database.migrate();

      expect(trades.getTradeById('legacy-trade')).toMatchObject({
        entryNote: null,
        netResultUsd: '25',
        reviewNote: null,
        reviewStatus: TRADE_REVIEW_STATUSES.unreviewed,
        resultValue: '25',
      });
      expect(database.pendingMigrations()).toEqual([]);
    } finally {
      storage.close();
    }
  });
});
