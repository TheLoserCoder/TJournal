// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CreateTradeUseCase,
  TRADE_DIRECTIONS,
  TRADE_RESULT_KINDS,
  UpdateTradeUseCase,
  type ClosedTrade,
} from '@tjournal/trade';

import { SqliteAccountStore } from './sqlite-account-store';
import { SqliteInstrumentStore } from './sqlite-instrument-store';
import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteTradeStore } from './sqlite-trade-store';
import { SqliteTradeUnitOfWork } from './sqlite-trade-unit-of-work';
import { SqliteVaultDatabase } from './sqlite-vault-database';

const createTemporaryDirectory = (): string => mkdtempSync(join(tmpdir(), 'tjournal-'));
const TEST_CLOSED_AT = '2026-09-21T12:00:00.000Z';

describe('SqliteTradeUnitOfWork', () => {
  it('rolls back a trade edit when the remembered account risk cannot be written', () => {
    const parentDirectory = createTemporaryDirectory();
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const accounts = new SqliteAccountStore(database);
    const trades = new SqliteTradeStore(database);
    const tradeUnitOfWork = new SqliteTradeUnitOfWork(database);
    const createTrade = new CreateTradeUseCase(
      trades,
      tradeUnitOfWork,
      accounts,
      undefined,
      new SqliteInstrumentStore(database),
    );
    const updateTrade = new UpdateTradeUseCase(trades, tradeUnitOfWork, accounts);

    try {
      storage.createVault(join(parentDirectory, 'journal'));
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      accounts.createAccount({
        defaultRiskUsd: '100',
        defaults: [],
        id: 'atomic-account',
        name: 'Atomic account',
        openingBalanceUsd: '1000',
      });
      const trade = createTrade.execute(
        {
          accountId: 'atomic-account',
          closedAt: TEST_CLOSED_AT,
          direction: TRADE_DIRECTIONS.long,
          execution: null,
          instrumentId: instrument.id,
          resultKind: TRADE_RESULT_KINDS.cash,
          resultValue: '10',
        },
        'atomic-trade',
      );

      // An archived account cannot store a new remembered risk, so the dialog
      // edit must roll back instead of committing on its own.
      accounts.archiveAccount('atomic-account');
      const edited: ClosedTrade = {
        ...trade,
        resultKind: TRADE_RESULT_KINDS.r,
        resultValue: '2',
      };

      expect(() => updateTrade.execute(edited)).toThrow();

      const persisted = trades.listTrades().find((item) => item.id === 'atomic-trade');
      expect(persisted?.inputResultKind).toBe(TRADE_RESULT_KINDS.cash);
      expect(persisted?.inputResultValue).toBe('10');
      expect(persisted?.netResultUsd).toBe('10');
      expect(persisted?.resultValue).toBe('10');
      const account = accounts.listAccounts().find((item) => item.id === 'atomic-account');
      expect(account?.defaultRiskUsd).toBe('100');
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('rolls back store writes made inside a failing unit of work', () => {
    const parentDirectory = createTemporaryDirectory();
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const trades = new SqliteTradeStore(database);
    const tradeUnitOfWork = new SqliteTradeUnitOfWork(database);

    try {
      storage.createVault(join(parentDirectory, 'journal'));
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      const trade = trades.createTrade({
        closedAt: TEST_CLOSED_AT,
        direction: TRADE_DIRECTIONS.long,
        entryNote: null,
        execution: null,
        id: 'rollback-trade',
        instrumentId: instrument.id,
        resultKind: TRADE_RESULT_KINDS.cash,
        resultSource: 'manual',
        resultValue: '5',
        reviewNote: null,
        reviewStatus: 'unreviewed',
        riskBindingSnapshot: null,
        tagIds: [],
      });

      expect(() =>
        tradeUnitOfWork.execute(() => {
          trades.updateTrade({ ...trade, closedAt: '2026-09-22T12:00:00.000Z' });
          throw new Error('unit of work failure');
        }),
      ).toThrow('unit of work failure');

      expect(trades.listTrades()[0]?.closedAt).toBe(TEST_CLOSED_AT);
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });
});
