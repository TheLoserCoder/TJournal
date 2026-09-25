// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { TRADE_RESULT_SOURCES } from '@tjournal/trade';

import { SqliteAnalyticsFactSource } from './sqlite-analytics-fact-source';
import { SqliteInstrumentStore } from './sqlite-instrument-store';
import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteTradeStore } from './sqlite-trade-store';
import { SqliteVaultDatabase } from './sqlite-vault-database';

describe('SqliteAnalyticsFactSource', () => {
  it('streams exact USD facts through half-open UTC and catalog filters', () => {
    const parent = mkdtempSync(join(tmpdir(), 'tjournal-analytics-'));
    const database = new SqliteVaultDatabase();
    try {
      const storage = new SqliteJournalStorage(database);
      storage.createVault(join(parent, 'vault'));
      const instrument = new SqliteInstrumentStore(database)
        .listInstruments()
        .find((item) => item.symbol === 'EURUSD');
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      const trades = new SqliteTradeStore(database);
      trades.createTrade({
        closedAt: '2026-09-01T12:00:00.000Z',
        direction: 'long',
        entryNote: null,
        execution: null,
        id: 'included',
        instrumentId: instrument.id,
        netResultUsd: '0.1',
        resultKind: 'cash',
        resultSource: TRADE_RESULT_SOURCES.manual,
        resultValue: '0.1',
        reviewNote: null,
        reviewStatus: 'unreviewed',
        riskBindingSnapshot: null,
        tagIds: [],
      });
      trades.createTrade({
        closedAt: '2026-09-01T13:00:00.000Z',
        direction: 'long',
        entryNote: null,
        execution: null,
        id: 'legacy-uncovered',
        instrumentId: instrument.id,
        resultKind: 'cash',
        resultSource: TRADE_RESULT_SOURCES.manual,
        resultValue: '99',
        reviewNote: null,
        reviewStatus: 'unreviewed',
        riskBindingSnapshot: null,
        tagIds: [],
      });
      trades.createTrade({
        closedAt: '2026-09-02T00:00:00.000Z',
        direction: 'short',
        entryNote: null,
        execution: null,
        id: 'exclusive-boundary',
        instrumentId: instrument.id,
        netResultUsd: '1',
        resultKind: 'cash',
        resultSource: TRADE_RESULT_SOURCES.manual,
        resultValue: '1',
        reviewNote: null,
        reviewStatus: 'unreviewed',
        riskBindingSnapshot: null,
        tagIds: [],
      });
      new SqliteInstrumentStore(database).updateInstrument({
        calculationProfile: null,
        category: 'crypto',
        id: instrument.id,
        symbol: 'RENAMED',
      });
      const source = new SqliteAnalyticsFactSource(database);
      const facts = [
        ...source.scanChronologically({
          filters: {
            accountIds: [],
            categories: ['crypto'],
            directions: ['long'],
            includeUnassigned: false,
            instrumentIds: [instrument.id],
          },
          range: {
            fromInclusive: '2026-09-01T00:00:00.000Z',
            toExclusive: '2026-09-02T00:00:00.000Z',
          },
        }),
      ];

      expect(facts).toHaveLength(2);
      expect(facts[0]).toMatchObject({
        id: 'included',
        instrumentCategory: 'crypto',
        instrumentLabel: 'EURUSD',
        netResultUsd: '0.1',
      });
      expect(facts[1]).toMatchObject({ id: 'legacy-uncovered', netResultUsd: null });
    } finally {
      database.close();
      rmSync(parent, { force: true, recursive: true });
    }
  });
});
