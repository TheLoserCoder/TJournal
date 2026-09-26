// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { calculateTradeSummary, summarizeTradeFacts } from '@tjournal/analytics';
import type { ClosedTrade } from '@tjournal/trade';
import { TRADE_DIRECTIONS, TRADE_RESULT_SOURCES } from '@tjournal/trade';
import { describe, expect, it } from 'vitest';

import { SqliteInstrumentStore } from './sqlite-instrument-store';
import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteTradeStore } from './sqlite-trade-store';
import { SqliteTradeSummaryFactSource } from './sqlite-trade-summary-fact-source';
import { SqliteVaultDatabase } from './sqlite-vault-database';
import { countDatabaseQueries } from './testing/query-counter';

type TradeInput = Omit<ClosedTrade, 'instrumentSymbol'>;

const baseTrade = (id: string, instrumentId: string): TradeInput => ({
  closedAt: '2026-09-10T12:00:00.000Z',
  direction: TRADE_DIRECTIONS.long,
  entryNote: null,
  execution: null,
  id,
  instrumentId,
  resultKind: 'cash',
  resultSource: TRADE_RESULT_SOURCES.manual,
  resultValue: '10',
  reviewNote: null,
  reviewStatus: 'unreviewed',
  riskBindingSnapshot: null,
  tagIds: [],
});

const makeFixtures = (instrumentId: string): readonly TradeInput[] => [
  { ...baseTrade('cash-1', instrumentId), netResultUsd: '100' },
  { ...baseTrade('cash-2', instrumentId), netResultUsd: '-20' },
  { ...baseTrade('cash-3', instrumentId), netResultUsd: '0' },
  // Legacy cash result without an explicit USD column falls back to the value.
  baseTrade('legacy-cash', instrumentId),
  {
    ...baseTrade('percent-1', instrumentId),
    inputResultKind: 'percent',
    inputResultValue: '5',
    netResultUsd: '50',
    resultKind: 'percent',
    resultValue: '5',
  },
  {
    ...baseTrade('r-1', instrumentId),
    resultKind: 'r',
    resultValue: '2',
    riskBindingSnapshot: { kind: 'cash', source: 'vault-default', value: '25' },
  },
  {
    ...baseTrade('r-unbound', instrumentId),
    resultKind: 'r',
    resultValue: '3',
  },
  {
    ...baseTrade('account-bound', instrumentId),
    account: {
      accountId: 'account-1',
      accountName: 'Primary',
      balanceBeforeUsd: '1000',
      balanceImpactUsd: '42',
      conversion: 'cash',
      conversionBalanceUsd: null,
      initialRiskUsd: null,
    },
  },
];

const buildVault = (parentDirectory: string): SqliteVaultDatabase => {
  const database = new SqliteVaultDatabase();
  new SqliteJournalStorage(database).createVault(join(parentDirectory, 'journal'));
  database
    .require()
    .prepare(
      'INSERT INTO accounts (id, name, opening_balance_usd, created_at, updated_at, archived_at, default_risk_usd) VALUES (?, ?, ?, ?, ?, NULL, NULL)',
    )
    .run('account-1', 'Primary', '1000', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
  return database;
};

describe('SqliteTradeSummaryFactSource', () => {
  it('matches the full trade read for every summary filter and metric', () => {
    const parent = mkdtempSync(join(tmpdir(), 'tjournal-summary-facts-'));
    const database = buildVault(parent);
    try {
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      const trades = new SqliteTradeStore(database);
      makeFixtures(instrument.id).forEach((trade) => trades.createTrade(trade));
      const source = new SqliteTradeSummaryFactSource(database);
      const baseline = trades.listTrades();

      const queries = [
        { metric: 'cash' as const, filters: null },
        {
          metric: 'cash' as const,
          filters: {
            closedFrom: null,
            closedTo: null,
            instrumentIds: [instrument.id],
            netResultBounds: { maximum: '100', minimum: '-20' },
            resultKinds: null,
          },
        },
        {
          metric: 'cash' as const,
          filters: {
            closedFrom: null,
            closedTo: null,
            instrumentIds: null,
            netResultBounds: { maximum: '50', minimum: '50' },
            resultKinds: null,
          },
        },
        {
          metric: 'cash' as const,
          filters: {
            closedFrom: null,
            closedTo: null,
            instrumentIds: null,
            resultKinds: null,
            textQuery: 'CASH',
          },
        },
        {
          metric: 'percent' as const,
          filters: {
            closedFrom: null,
            closedTo: null,
            instrumentIds: null,
            resultKinds: null,
            resultUnits: ['percent' as const],
          },
        },
        {
          metric: 'r' as const,
          filters: {
            closedFrom: null,
            closedTo: null,
            instrumentIds: null,
            resultKinds: ['r' as const],
          },
        },
        {
          metric: 'cash' as const,
          filters: {
            accountIds: ['account-1'],
            closedFrom: null,
            closedTo: null,
            includeUnassigned: true,
            instrumentIds: null,
            resultKinds: null,
          },
        },
        {
          metric: 'cash' as const,
          filters: {
            closedFrom: '2026-09-11T00:00:00.000Z',
            closedTo: null,
            instrumentIds: null,
            resultKinds: null,
          },
        },
      ];

      for (const { filters, metric } of queries) {
        const query = {
          filters,
          metric,
          neutralCostSettings: { includeCommission: false, includeSpread: false },
          neutralRange: { lower: '-1', upper: '1' },
          now: new Date('2026-09-10T12:00:00.000Z'),
          period: 'all' as const,
        };
        const streamed = summarizeTradeFacts(source.scanSummaryFacts(), query);
        const full = calculateTradeSummary(baseline, query);
        expect(streamed).toEqual(full);
      }
    } finally {
      database.close();
      rmSync(parent, { force: true, recursive: true });
    }
  });

  it('prepares a single streamed statement and does not scan before iteration', () => {
    const parent = mkdtempSync(join(tmpdir(), 'tjournal-summary-counts-'));
    const database = buildVault(parent);
    const counter = countDatabaseQueries(database);
    try {
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      const trades = new SqliteTradeStore(database);
      makeFixtures(instrument.id).forEach((trade) => trades.createTrade(trade));
      const source = new SqliteTradeSummaryFactSource(database);

      counter.reset();
      const iterable = source.scanSummaryFacts();
      const iterator = iterable[Symbol.iterator]();
      expect(counter.count()).toBe(0);

      const first = iterator.next();
      expect(first.done).toBe(false);
      expect(counter.count()).toBe(1);

      let drained = 0;
      while (!iterator.next().done) drained += 1;
      expect(drained).toBeGreaterThan(0);
      expect(counter.count()).toBe(1);
    } finally {
      counter.restore();
      database.close();
      rmSync(parent, { force: true, recursive: true });
    }
  });
});
