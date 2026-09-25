// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EXIT_ALLOCATION_KINDS,
  TRADE_DIRECTIONS,
  TRADE_RESULT_KINDS,
  TRADE_RESULT_SOURCES,
} from '@tjournal/trade';

import { SqliteAccountStore } from './sqlite-account-store';
import { SqliteInstrumentStore } from './sqlite-instrument-store';
import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteTagStore } from './sqlite-tag-store';
import { SqliteTradeStore } from './sqlite-trade-store';
import { SqliteVaultDatabase } from './sqlite-vault-database';

const createTemporaryDirectory = (): string => mkdtempSync(join(tmpdir(), 'tjournal-'));
const TEST_CLOSED_AT = '2026-09-21T12:00:00.000Z';

describe('point lookups', () => {
  it('returns a single trade with ordered exits and tags', () => {
    const parentDirectory = createTemporaryDirectory();
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const trades = new SqliteTradeStore(database);
    const tags = new SqliteTagStore(database);

    try {
      storage.createVault(join(parentDirectory, 'journal'));
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      tags.createTag({
        color: 'blue',
        description: '',
        id: 'tag-lookup',
        name: 'Lookup',
        nameKey: 'lookup',
      });
      trades.createTrade({
        closedAt: TEST_CLOSED_AT,
        direction: TRADE_DIRECTIONS.long,
        entryNote: null,
        execution: {
          commissionUsd: '1',
          entryPrice: '100',
          exits: [
            {
              allocationKind: EXIT_ALLOCATION_KINDS.percent,
              allocationValue: '40',
              exitPrice: '101',
              id: 'exit-first',
              order: 0,
              reportedResultKind: null,
              reportedResultValue: null,
            },
            {
              allocationKind: EXIT_ALLOCATION_KINDS.percent,
              allocationValue: '60',
              exitPrice: '103',
              id: 'exit-second',
              order: 1,
              reportedResultKind: null,
              reportedResultValue: null,
            },
          ],
          instrumentSnapshot: { tickSize: '0.5', tickValueUsdPerLot: '10' },
          quantityLots: '1',
          spreadTicks: '0',
          stopLossPrice: null,
        },
        id: 'trade-lookup',
        instrumentId: instrument.id,
        netResultUsd: '19',
        resultKind: TRADE_RESULT_KINDS.cash,
        resultSource: TRADE_RESULT_SOURCES.calculated,
        resultValue: '19',
        reviewNote: null,
        reviewStatus: 'unreviewed',
        riskBindingSnapshot: null,
        tagIds: ['tag-lookup'],
      });

      const trade = trades.getTradeById('trade-lookup');
      expect(trade?.id).toBe('trade-lookup');
      expect(trade?.instrumentSymbol).toBe(instrument.symbol);
      expect(trade?.tagIds).toEqual(['tag-lookup']);
      expect(trade?.execution?.exits.map((exit) => exit.id)).toEqual(['exit-first', 'exit-second']);
      expect(trade?.execution?.exits.map((exit) => exit.order)).toEqual([0, 1]);

      expect(trades.getTradeById('missing-trade')).toBeNull();
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('keeps manual trades without executions and exposes account/instrument/tag lookups', () => {
    const parentDirectory = createTemporaryDirectory();
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const trades = new SqliteTradeStore(database);
    const accounts = new SqliteAccountStore(database);
    const instruments = new SqliteInstrumentStore(database);
    const tags = new SqliteTagStore(database);

    try {
      storage.createVault(join(parentDirectory, 'journal'));
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      accounts.createAccount({
        defaults: [],
        id: 'lookup-account',
        name: 'Lookup account',
        openingBalanceUsd: '1000',
      });
      trades.createTrade({
        closedAt: TEST_CLOSED_AT,
        direction: TRADE_DIRECTIONS.short,
        entryNote: null,
        execution: null,
        id: 'manual-trade',
        instrumentId: instrument.id,
        netResultUsd: '5',
        resultKind: TRADE_RESULT_KINDS.cash,
        resultSource: TRADE_RESULT_SOURCES.manual,
        resultValue: '5',
        reviewNote: null,
        reviewStatus: 'unreviewed',
        riskBindingSnapshot: null,
        tagIds: [],
      });
      tags.createTag({
        color: 'rose',
        description: '',
        id: 'lookup-tag',
        name: 'Lookup tag',
        nameKey: 'lookup tag',
      });

      expect(trades.getTradeById('manual-trade')?.execution).toBeNull();
      expect(accounts.getAccountById('lookup-account')?.name).toBe('Lookup account');
      expect(accounts.getAccountById('missing-account')).toBeNull();
      expect(instruments.getInstrumentById(instrument.id)?.symbol).toBe(instrument.symbol);
      expect(instruments.getInstrumentById('missing-instrument')).toBeNull();
      expect(tags.getTagById('lookup-tag')?.name).toBe('Lookup tag');
      expect(tags.getTagById('missing-tag')).toBeNull();
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });
});
