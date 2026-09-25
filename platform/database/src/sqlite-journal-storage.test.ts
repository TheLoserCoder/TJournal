// @vitest-environment node

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { AppError } from '@tjournal/platform-errors';
import {
  CreateTradeUseCase,
  EXIT_ALLOCATION_KINDS,
  TRADE_DIRECTIONS,
  TRADE_RESULT_KINDS,
  TRADE_RESULT_SOURCES,
  TradeValidationError,
  UpdateTradeUseCase,
} from '@tjournal/trade';

import { SqliteInstrumentStore } from './sqlite-instrument-store';
import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteAccountStore } from './sqlite-account-store';
import { SqliteTradeStore } from './sqlite-trade-store';
import { SqliteTradeUnitOfWork } from './sqlite-trade-unit-of-work';
import { SqliteVaultDatabase } from './sqlite-vault-database';

const createTemporaryDirectory = (): string => mkdtempSync(join(tmpdir(), 'tjournal-'));
const FIRST_TRADE_ID = 'trade-first';
const SECOND_TRADE_ID = 'trade-second';
const UNKNOWN_TRADE_ID = 'trade-unknown';
const TEST_CLOSED_AT = '2026-09-13T12:00:00.000Z';
const TEST_RESULT_KIND = 'cash' as const;
const TEST_RESULT_VALUE = '12.50';

describe('SqliteJournalStorage', () => {
  it('creates a vault, persists a trade, and can open it again', () => {
    const parentDirectory = createTemporaryDirectory();
    const vaultPath = join(parentDirectory, 'journal');
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const trades = new SqliteTradeStore(database);

    try {
      const descriptor = storage.createVault(vaultPath);
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      trades.createTrade({
        closedAt: '2026-09-13T12:00:00.000Z',
        direction: TRADE_DIRECTIONS.long,
        entryNote: null,
        execution: null,
        id: 'trade-1',
        instrumentId: instrument.id,
        resultKind: 'cash',
        resultSource: TRADE_RESULT_SOURCES.manual,
        resultValue: '12.50',
        reviewNote: null,
        reviewStatus: 'unreviewed',
        riskBindingSnapshot: null,
        tagIds: [],
      });

      expect(descriptor.path).toBe(vaultPath);
      expect(existsSync(join(vaultPath, 'attachments'))).toBe(true);
      expect(existsSync(join(vaultPath, 'backups'))).toBe(true);
      expect(existsSync(join(vaultPath, 'journal.sqlite'))).toBe(true);
      expect(
        JSON.parse(readFileSync(join(vaultPath, '.tjournal-vault.json'), 'utf8')),
      ).toMatchObject({ formatVersion: 1 });
      expect(trades.listTrades()).toEqual([
        expect.objectContaining({ id: 'trade-1', resultValue: '12.50' }),
      ]);
      storage.close();

      storage.openVault(vaultPath);
      storage.checkIntegrity();
      expect(trades.listTrades()).toHaveLength(1);
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('refuses to initialise a non-empty directory', () => {
    const vaultPath = createTemporaryDirectory();
    const storage = new SqliteJournalStorage();
    mkdirSync(join(vaultPath, 'existing'));

    try {
      try {
        storage.createVault(vaultPath);
        throw new Error('Expected vault creation to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('vault-already-initialized');
      }
    } finally {
      storage.close();
      rmSync(vaultPath, { force: true, recursive: true });
    }
  });

  it('keeps the vault error when an account is created without an open vault', () => {
    const accounts = new SqliteAccountStore(new SqliteVaultDatabase());

    try {
      accounts.createAccount({
        id: 'account-without-vault',
        name: 'Test account',
        openingBalanceUsd: '0',
      });
      throw new Error('Expected account creation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('vault-not-accessible');
    }
  });

  it('deletes many trades atomically and restores them together', () => {
    const parentDirectory = createTemporaryDirectory();
    const vaultPath = join(parentDirectory, 'journal');
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const trades = new SqliteTradeStore(database);

    try {
      storage.createVault(vaultPath);
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      const tradeIds = [FIRST_TRADE_ID, SECOND_TRADE_ID] as const;
      for (const id of tradeIds) {
        trades.createTrade({
          closedAt: TEST_CLOSED_AT,
          direction: TRADE_DIRECTIONS.long,
          entryNote: null,
          execution: null,
          id,
          instrumentId: instrument.id,
          resultKind: TEST_RESULT_KIND,
          resultSource: TRADE_RESULT_SOURCES.manual,
          resultValue: TEST_RESULT_VALUE,
          reviewNote: null,
          reviewStatus: 'unreviewed',
          riskBindingSnapshot: null,
          tagIds: [],
        });
      }

      expect(() => trades.deleteTrades([FIRST_TRADE_ID, UNKNOWN_TRADE_ID])).toThrow();
      expect(trades.listTrades()).toHaveLength(tradeIds.length);

      const deleted = trades.deleteTrades(tradeIds);
      expect(trades.listTrades()).toHaveLength(0);
      trades.restoreTrades(deleted);
      expect(trades.listTrades()).toHaveLength(tradeIds.length);
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('persists an account-linked trade with its balance snapshot', () => {
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

    try {
      storage.createVault(vaultPath);
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      accounts.createAccount({
        defaults: [],
        id: 'account-primary',
        name: 'Primary account',
        openingBalanceUsd: '1000',
      });

      const trade = createTrade.execute(
        {
          accountId: 'account-primary',
          closedAt: TEST_CLOSED_AT,
          direction: TRADE_DIRECTIONS.long,
          execution: null,
          instrumentId: instrument.id,
          resultKind: TEST_RESULT_KIND,
          resultValue: '25',
        },
        'account-trade',
      );

      expect(trade.account).toMatchObject({
        accountId: 'account-primary',
        balanceBeforeUsd: '1000',
        balanceImpactUsd: '25',
        conversion: 'cash',
      });
      expect(accounts.getAccountBalance('account-primary').currentKnownBalanceUsd).toBe('1025');
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('accounts deposits and withdrawals without allowing an excessive withdrawal', () => {
    const parentDirectory = createTemporaryDirectory();
    const vaultPath = join(parentDirectory, 'journal');
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const accounts = new SqliteAccountStore(database);

    try {
      storage.createVault(vaultPath);
      accounts.createAccount({
        defaults: [],
        id: 'cash-account',
        name: 'Cash account',
        openingBalanceUsd: '100',
      });
      accounts.createCashMovement({
        accountId: 'cash-account',
        amountUsd: '25',
        id: 'deposit-1',
        occurredAt: TEST_CLOSED_AT,
        kind: 'deposit',
      });
      const withdrawal = accounts.createCashMovement({
        accountId: 'cash-account',
        amountUsd: '125',
        id: 'withdrawal-1',
        occurredAt: TEST_CLOSED_AT,
        kind: 'withdrawal',
      });
      expect(withdrawal.amountUsd).toBe('125');
      expect(accounts.getAccountBalance('cash-account').currentKnownBalanceUsd).toBe('0');
      expect(() =>
        accounts.createCashMovement({
          accountId: 'cash-account',
          amountUsd: '0.01',
          id: 'withdrawal-2',
          occurredAt: TEST_CLOSED_AT,
          kind: 'withdrawal',
        }),
      ).toThrow(/available account balance/);
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('keeps a saved percentage conversion stable when only metadata changes', () => {
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
        id: 'stable-conversion-account',
        name: 'Stable conversion account',
        openingBalanceUsd: '1000',
      });

      const percentageTrade = createTrade.execute({
        accountId: 'stable-conversion-account',
        closedAt: TEST_CLOSED_AT,
        direction: TRADE_DIRECTIONS.long,
        execution: null,
        instrumentId: instrument.id,
        resultKind: TRADE_RESULT_KINDS.percent,
        resultValue: '10',
      });
      createTrade.execute({
        accountId: 'stable-conversion-account',
        closedAt: TEST_CLOSED_AT,
        direction: TRADE_DIRECTIONS.long,
        execution: null,
        instrumentId: instrument.id,
        resultKind: TRADE_RESULT_KINDS.cash,
        resultValue: '100',
      });

      const updated = updateTrade.execute({
        ...percentageTrade,
        closedAt: '2026-09-14T12:00:00.000Z',
      });

      expect(updated.netResultUsd).toBe('100');
      expect(updated.account?.balanceBeforeUsd).toBe('1000');
      expect(accounts.getAccountBalance('stable-conversion-account').currentKnownBalanceUsd).toBe(
        '1200',
      );
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('does not rebase an unresolved legacy percentage during account assignment', () => {
    const parentDirectory = createTemporaryDirectory();
    const vaultPath = join(parentDirectory, 'journal');
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const accounts = new SqliteAccountStore(database);
    const trades = new SqliteTradeStore(database);
    const tradeUnitOfWork = new SqliteTradeUnitOfWork(database);
    const updateTrade = new UpdateTradeUseCase(trades, tradeUnitOfWork, accounts);

    try {
      storage.createVault(vaultPath);
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      accounts.createAccount({
        defaults: [],
        id: 'legacy-assignment-account',
        name: 'Legacy assignment account',
        openingBalanceUsd: '1000',
      });
      trades.createTrade({
        closedAt: TEST_CLOSED_AT,
        direction: TRADE_DIRECTIONS.long,
        entryNote: null,
        execution: null,
        id: 'legacy-percent-trade',
        instrumentId: instrument.id,
        resultKind: TRADE_RESULT_KINDS.percent,
        resultSource: TRADE_RESULT_SOURCES.manual,
        resultValue: '10',
        reviewNote: null,
        reviewStatus: 'unreviewed',
        riskBindingSnapshot: null,
        tagIds: [],
      });
      const legacyTrade = trades.listTrades()[0];
      if (legacyTrade === undefined) throw new Error('Legacy trade is missing.');

      let caught: unknown = null;
      try {
        updateTrade.execute({
          ...legacyTrade,
          account: {
            accountId: 'legacy-assignment-account',
            accountName: 'Legacy assignment account',
            balanceBeforeUsd: '1000',
            balanceImpactUsd: null,
            conversion: null,
          },
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(TradeValidationError);
      expect((caught as TradeValidationError).issues).toContainEqual({
        code: 'unresolved-legacy-result',
        path: 'resultValue',
      });
      expect(trades.listTrades()[0]?.account).toBeNull();
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('snapshots an instrument profile and rebinds eligible R trades transactionally', () => {
    const parentDirectory = createTemporaryDirectory();
    const vaultPath = join(parentDirectory, 'journal');
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const trades = new SqliteTradeStore(database);
    const accounts = new SqliteAccountStore(database);
    const tradeUnitOfWork = new SqliteTradeUnitOfWork(database);
    const createTrade = new CreateTradeUseCase(
      trades,
      tradeUnitOfWork,
      accounts,
      undefined,
      new SqliteInstrumentStore(database),
    );

    try {
      storage.createVault(vaultPath);
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      accounts.createAccount({
        defaults: [],
        id: 'calculation-account',
        name: 'Calculation account',
        openingBalanceUsd: '1000',
      });
      new SqliteInstrumentStore(database).saveInstrumentProfile({
        instrumentId: instrument.id,
        tickSize: '0.5',
        tickValueUsdPerLot: '10',
        updatedAt: TEST_CLOSED_AT,
      });
      const calculated = createTrade.execute({
        accountId: 'calculation-account',
        closedAt: TEST_CLOSED_AT,
        direction: TRADE_DIRECTIONS.long,
        execution: {
          commissionUsd: '5',
          entryPrice: '100',
          exits: [
            {
              allocationKind: EXIT_ALLOCATION_KINDS.percent,
              allocationValue: '100',
              exitPrice: '102',
              id: 'exit',
              order: 0,
              reportedResultKind: null,
              reportedResultValue: null,
            },
          ],
          quantityLots: '1',
          spreadTicks: '1',
          stopLossPrice: null,
        },
        instrumentId: instrument.id,
        resultKind: TRADE_RESULT_KINDS.cash,
        resultValue: '999',
      });
      expect(calculated.resultValue).toBe('25');
      expect(calculated.resultSource).toBe(TRADE_RESULT_SOURCES.calculated);
      expect(calculated.execution?.instrumentSnapshot.tickSize).toBe('0.5');

      const basePreferences = trades.getTradePreferences();
      trades.saveTradePreferences({
        ...basePreferences,
        neutralCostSettings: { includeCommission: true, includeSpread: true },
        riskBinding: { kind: 'cash', value: '100' },
      });
      expect(trades.getTradePreferences().neutralCostSettings).toEqual({
        includeCommission: true,
        includeSpread: true,
      });
      const riskTrade = createTrade.execute({
        accountId: 'calculation-account',
        closedAt: TEST_CLOSED_AT,
        direction: TRADE_DIRECTIONS.short,
        execution: null,
        instrumentId: instrument.id,
        resultKind: TRADE_RESULT_KINDS.r,
        resultValue: '2.5',
        riskUsd: '100',
      });
      expect(riskTrade.riskBindingSnapshot?.value).toBe('100');
      trades.saveTradePreferences(
        { ...basePreferences, riskBinding: { kind: 'cash', value: '200' } },
        true,
      );
      expect(
        trades.listTrades().find((trade) => trade.id === riskTrade.id)?.riskBindingSnapshot?.value,
      ).toBe('200');
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('increments independent revisions for data that can invalidate analytics', () => {
    const parentDirectory = createTemporaryDirectory();
    const vaultPath = join(parentDirectory, 'journal');
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);
    const trades = new SqliteTradeStore(database);

    try {
      storage.createVault(vaultPath);
      const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      const initial = database.getDataRevisions();
      trades.createTrade({
        closedAt: TEST_CLOSED_AT,
        direction: TRADE_DIRECTIONS.long,
        entryNote: null,
        execution: null,
        id: 'revision-trade',
        instrumentId: instrument.id,
        resultKind: TEST_RESULT_KIND,
        resultSource: TRADE_RESULT_SOURCES.manual,
        resultValue: TEST_RESULT_VALUE,
        reviewNote: null,
        reviewStatus: 'unreviewed',
        riskBindingSnapshot: null,
        tagIds: [],
      });
      const afterTrade = database.getDataRevisions();
      expect(afterTrade.trades).toBe((initial.trades ?? 0) + 1);

      new SqliteInstrumentStore(database).createInstrument({
        category: 'forex',
        id: 'revision-instrument',
        symbol: 'REVISION',
      });
      const afterInstrument = database.getDataRevisions();
      expect(afterInstrument.instruments).toBe((afterTrade.instruments ?? 0) + 1);

      new SqliteInstrumentStore(database).saveInstrumentProfile({
        instrumentId: instrument.id,
        tickSize: '0.1',
        tickValueUsdPerLot: '1',
        updatedAt: TEST_CLOSED_AT,
      });
      expect(database.getDataRevisions()['instrument-profiles']).toBe(1);

      trades.saveTradePreferences(trades.getTradePreferences());
      expect(database.getDataRevisions()['trade-preferences']).toBe(1);
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('inspects a valid vault without opening it', () => {
    const parentDirectory = createTemporaryDirectory();
    const vaultPath = join(parentDirectory, 'journal');
    const storage = new SqliteJournalStorage();

    try {
      storage.createVault(vaultPath);

      // The explicit "check" runs while the same vault is open in the active session.
      expect(storage.inspectVault(vaultPath).path).toBe(vaultPath);

      storage.close();
      const descriptor = storage.inspectVault(vaultPath);

      expect(descriptor.path).toBe(vaultPath);
      expect(storage.getStatus()).toEqual({ isOpen: false, path: null });
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('reports a non-vault folder as invalid and a missing path as inaccessible', () => {
    const parentDirectory = createTemporaryDirectory();
    const storage = new SqliteJournalStorage();

    try {
      try {
        storage.inspectVault(parentDirectory);
        throw new Error('Expected inspection of a non-vault folder to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('vault-invalid');
      }

      try {
        storage.inspectVault(join(parentDirectory, 'missing'));
        throw new Error('Expected inspection of a missing path to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('vault-not-accessible');
      }
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });
});
