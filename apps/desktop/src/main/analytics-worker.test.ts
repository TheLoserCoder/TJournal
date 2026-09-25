// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  SqliteInstrumentStore,
  SqliteJournalStorage,
  SqliteTradeStore,
  SqliteVaultDatabase,
} from '@tjournal/platform-database';
import { TRADE_RESULT_SOURCES } from '@tjournal/trade';
import { describe, expect, it } from 'vitest';

import run from './analytics-worker';
import type { AnalyticsReportRequestDto } from '../shared/desktop-api';

const REPORT_QUERY: AnalyticsReportRequestDto = {
  breakdown: { dimension: 'instrument', limit: 50, metric: 'net-result' },
  filters: {
    accountIds: [],
    categories: [],
    directions: [],
    includeUnassigned: false,
    instrumentIds: [],
  },
  range: { fromInclusive: null, toExclusive: null },
  timeGrain: 'auto',
};

const createVaultWithTrades = (parentDirectory: string): string => {
  const database = new SqliteVaultDatabase();
  try {
    const storage = new SqliteJournalStorage(database);
    storage.createVault(join(parentDirectory, 'vault'));
    const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
    if (instrument === undefined) throw new Error('Seed instrument is missing.');
    const trades = new SqliteTradeStore(database);
    for (const [id, closedAt, netResultUsd] of [
      ['first', '2026-09-01T12:00:00.000Z', '0.1'],
      ['second', '2026-09-02T12:00:00.000Z', '0.2'],
    ] as const) {
      trades.createTrade({
        closedAt,
        direction: 'long',
        entryNote: null,
        execution: null,
        id,
        instrumentId: instrument.id,
        netResultUsd,
        resultKind: 'cash',
        resultSource: TRADE_RESULT_SOURCES.manual,
        resultValue: netResultUsd,
        reviewNote: null,
        reviewStatus: 'unreviewed',
        riskBindingSnapshot: null,
        tagIds: [],
      });
    }
    const databasePath = database.getDatabasePath();
    if (databasePath === null) throw new Error('Vault database path is missing.');
    return databasePath;
  } finally {
    database.close();
  }
};

describe('analytics worker', () => {
  it('builds a bounded report from a real read-only vault', () => {
    const parentDirectory = mkdtempSync(join(tmpdir(), 'tjournal-worker-'));
    try {
      const databasePath = createVaultWithTrades(parentDirectory);
      const result = run({
        databasePath,
        kind: 'report',
        query: REPORT_QUERY,
        requestId: 'worker-test-request',
        vaultGeneration: 'worker-test-generation',
      });

      expect(result.kind).toBe('report');
      if (result.kind !== 'report') return;
      expect(result.report.coverage).toEqual({
        coveredTrades: 2,
        excludedTrades: 0,
        totalTrades: 2,
      });
      expect(result.report.kpis.netResultUsd).toBe('0.3');
      expect(result.report.breakdown.rows).toHaveLength(1);
      // All-time auto grain is month, so both September trades share one bucket.
      expect(result.report.effectiveRange.grain).toBe('month');
      expect(result.report.series).toHaveLength(1);
      expect(result.report.series[0]?.cumulativeNetResultUsd).toBe('0.3');
      expect(result.vaultGeneration).toBe('worker-test-generation');
      expect(result.requestId).toBe('worker-test-request');
    } finally {
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });
});
