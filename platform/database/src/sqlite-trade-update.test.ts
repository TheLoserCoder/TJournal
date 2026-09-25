// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CreateTradeUseCase,
  TRADE_DIRECTIONS,
  TRADE_REVIEW_STATUSES,
  TRADE_RESULT_KINDS,
  TradeValidationError,
  UpdateTradeUseCase,
} from '@tjournal/trade';

import { SqliteAccountStore } from './sqlite-account-store';
import { SqliteInstrumentStore } from './sqlite-instrument-store';
import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteTradeStore } from './sqlite-trade-store';
import { SqliteTradeUnitOfWork } from './sqlite-trade-unit-of-work';
import { SqliteVaultDatabase } from './sqlite-vault-database';

const createTemporaryDirectory = (): string => mkdtempSync(join(tmpdir(), 'tjournal-'));
const TEST_CLOSED_AT = '2026-09-21T12:00:00.000Z';

/** Writes a pre-account row exactly as an old vault would contain it. */
const insertLegacyTradeRow = (
  database: SqliteVaultDatabase,
  input: {
    readonly id: string;
    readonly instrumentId: string;
    readonly netResultUsd: string | null;
    readonly resultKind: 'cash' | 'percent';
    readonly resultValue: string;
  },
): void => {
  database
    .require()
    .prepare(
      `INSERT INTO trades (id, instrument, instrument_id, closed_at, direction, result_kind, result_value, result_source, net_result_usd)
       VALUES (?, ?, ?, ?, 'long', ?, ?, 'manual', ?)`,
    )
    .run(
      input.id,
      'LEGACY',
      input.instrumentId,
      TEST_CLOSED_AT,
      input.resultKind,
      input.resultValue,
      input.netResultUsd,
    );
};

describe('trade result rebinding', () => {
  it('rebinds the authoritative USD result when the dialog edits the result', () => {
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
        defaults: [],
        id: 'rebind-account',
        name: 'Rebind account',
        openingBalanceUsd: '1000',
      });
      const trade = createTrade.execute(
        {
          accountId: 'rebind-account',
          closedAt: TEST_CLOSED_AT,
          direction: TRADE_DIRECTIONS.long,
          execution: null,
          instrumentId: instrument.id,
          resultKind: TRADE_RESULT_KINDS.cash,
          resultValue: '10',
        },
        'rebind-trade',
      );
      expect(trade.netResultUsd).toBe('10');

      const rebound = updateTrade.execute({
        ...trade,
        resultKind: TRADE_RESULT_KINDS.percent,
        resultValue: '10',
      });

      expect(rebound.netResultUsd).toBe('100');
      expect(rebound.inputResultKind).toBe(TRADE_RESULT_KINDS.percent);
      expect(rebound.inputResultValue).toBe('10');
      expect(accounts.getAccountBalance('rebind-account').currentKnownBalanceUsd).toBe('1100');

      const persisted = trades.listTrades().find((item) => item.id === 'rebind-trade');
      expect(persisted?.netResultUsd).toBe('100');
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('persists normalized notes and explicit review status without rebasing finance snapshots', () => {
    const parentDirectory = createTemporaryDirectory();
    const vaultPath = join(parentDirectory, 'journal');
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
      storage.createVault(vaultPath);
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      accounts.createAccount({
        defaults: [],
        id: 'notes-account',
        name: 'Notes account',
        openingBalanceUsd: '1000',
      });
      const created = createTrade.execute(
        {
          accountId: 'notes-account',
          closedAt: TEST_CLOSED_AT,
          direction: TRADE_DIRECTIONS.long,
          entryNote: '  breakout after retest  ',
          execution: null,
          instrumentId: instrument.id,
          reviewNote: ' \t\n ',
          resultKind: TRADE_RESULT_KINDS.cash,
          resultValue: '25',
        },
        'qualitative-trade',
      );

      expect(created.entryNote).toBe('breakout after retest');
      expect(created.reviewNote).toBeNull();
      expect(created.reviewStatus).toBe(TRADE_REVIEW_STATUSES.unreviewed);

      const updated = updateTrade.execute({
        ...created,
        entryNote: '  reason revised  ',
        reviewNote: '\nreview line one\nreview line two\t ',
        reviewStatus: TRADE_REVIEW_STATUSES.reviewed,
      });

      expect(updated.entryNote).toBe('reason revised');
      expect(updated.reviewNote).toBe('review line one\nreview line two');
      expect(updated.reviewStatus).toBe(TRADE_REVIEW_STATUSES.reviewed);
      expect(updated.netResultUsd).toBe(created.netResultUsd);
      expect(updated.inputResultKind).toBe(created.inputResultKind);
      expect(updated.inputResultValue).toBe(created.inputResultValue);
      expect(updated.account).toEqual(created.account);
      expect(updated.riskBindingSnapshot).toEqual(created.riskBindingSnapshot);

      storage.close();
      storage.openVault(vaultPath);
      expect(trades.getTradeById(updated.id)).toEqual(updated);
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('assigns a legacy cash trade without rebasing its known USD result', () => {
    const parentDirectory = createTemporaryDirectory();
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const accounts = new SqliteAccountStore(database);
    const trades = new SqliteTradeStore(database);
    const updateTrade = new UpdateTradeUseCase(
      trades,
      new SqliteTradeUnitOfWork(database),
      accounts,
    );

    try {
      storage.createVault(join(parentDirectory, 'journal'));
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      accounts.createAccount({
        defaults: [],
        id: 'legacy-cash-account',
        name: 'Legacy cash account',
        openingBalanceUsd: '1000',
      });
      insertLegacyTradeRow(database, {
        id: 'legacy-cash-trade',
        instrumentId: instrument.id,
        netResultUsd: null,
        resultKind: TRADE_RESULT_KINDS.cash,
        resultValue: '10',
      });

      const legacy = trades.getTradeById('legacy-cash-trade');
      if (legacy === null) throw new Error('Legacy trade is missing.');
      expect(legacy.account).toBeNull();
      expect(legacy.netResultUsd).toBe('10');

      const assigned = updateTrade.execute({
        ...legacy,
        account: {
          accountId: 'legacy-cash-account',
          accountName: 'Legacy cash account',
          balanceBeforeUsd: '1000',
          balanceImpactUsd: null,
          conversion: null,
        },
      });

      expect(assigned.netResultUsd).toBe('10');
      expect(assigned.account?.accountId).toBe('legacy-cash-account');
      expect(assigned.account?.balanceImpactUsd).toBe('10');
      expect(accounts.getAccountBalance('legacy-cash-account').currentKnownBalanceUsd).toBe('1010');
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('resolves an unresolved legacy percentage only with an explicit USD result', () => {
    const parentDirectory = createTemporaryDirectory();
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const accounts = new SqliteAccountStore(database);
    const trades = new SqliteTradeStore(database);
    const updateTrade = new UpdateTradeUseCase(
      trades,
      new SqliteTradeUnitOfWork(database),
      accounts,
    );

    try {
      storage.createVault(join(parentDirectory, 'journal'));
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      accounts.createAccount({
        defaults: [],
        id: 'legacy-percent-account',
        name: 'Legacy percent account',
        openingBalanceUsd: '1000',
      });
      insertLegacyTradeRow(database, {
        id: 'legacy-percent-trade',
        instrumentId: instrument.id,
        netResultUsd: null,
        resultKind: TRADE_RESULT_KINDS.percent,
        resultValue: '10',
      });

      const legacy = trades.getTradeById('legacy-percent-trade');
      if (legacy === null) throw new Error('Legacy trade is missing.');
      expect(legacy.netResultUsd).toBeUndefined();

      let caught: unknown = null;
      try {
        updateTrade.execute({
          ...legacy,
          account: {
            accountId: 'legacy-percent-account',
            accountName: 'Legacy percent account',
            balanceBeforeUsd: '1000',
            balanceImpactUsd: null,
            conversion: null,
          },
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(TradeValidationError);
      expect(trades.getTradeById('legacy-percent-trade')?.account ?? null).toBeNull();

      const resolved = updateTrade.execute({
        ...legacy,
        account: {
          accountId: 'legacy-percent-account',
          accountName: 'Legacy percent account',
          balanceBeforeUsd: '1000',
          balanceImpactUsd: null,
          conversion: null,
        },
        resultKind: TRADE_RESULT_KINDS.cash,
        resultValue: '25',
      });

      expect(resolved.netResultUsd).toBe('25');
      expect(resolved.account?.accountId).toBe('legacy-percent-account');
      expect(accounts.getAccountBalance('legacy-percent-account').currentKnownBalanceUsd).toBe(
        '1025',
      );
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });
});
