import { describe, expect, it, vi } from 'vitest';

import type {
  AccountInstrumentDefaults,
  CreateTradingAccountInput,
  TradingAccount,
  UpdateTradingAccountInput,
} from '@tjournal/account';

import { DATA_RESOURCES } from '../../../shared/desktop-api';
import { UndoRedoHistory } from '../../history/undo-redo-history';
import { AccountCommands } from './account-commands';

const makeAccount = (overrides: Partial<TradingAccount> = {}): TradingAccount => ({
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  defaultRiskUsd: '100',
  id: 'account-1',
  name: 'Main',
  openingBalanceUsd: '10000',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const makeDefaults = (): readonly AccountInstrumentDefaults[] => [
  {
    accountId: 'account-1',
    commissionUsd: '1',
    instrumentId: 'instrument-1',
    spreadTicks: '2',
    tickSize: null,
    tickValueUsdPerLot: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const createHarness = () => {
  const state = { archived: false, deleted: false };
  const history = new UndoRedoHistory();
  const createAccountUseCase = {
    execute: vi.fn((input: CreateTradingAccountInput): TradingAccount =>
      makeAccount({ name: input.name }),
    ),
  };
  const updateAccountUseCase = {
    execute: vi.fn((input: UpdateTradingAccountInput): TradingAccount => makeAccount(input)),
  };
  const getAccountByIdUseCase = {
    execute: vi.fn((id: string): TradingAccount | null =>
      id === 'account-1' ? makeAccount() : null,
    ),
  };
  const deleteAccountUseCase = {
    execute: vi.fn((id: string): TradingAccount => {
      state.archived = true;
      return makeAccount({ id });
    }),
  };
  const restoreAccountUseCase = {
    execute: vi.fn((id: string): TradingAccount => makeAccount({ id, archivedAt: null })),
  };
  const archiveAccountUseCase = {
    execute: vi.fn((id: string): TradingAccount =>
      makeAccount({ id, archivedAt: '2026-02-01T00:00:00.000Z' }),
    ),
  };
  const listAccountsUseCase = {
    execute: vi.fn(() => {
      if (state.deleted) return [];
      return [
        {
          ...makeAccount({ archivedAt: state.archived ? '2026-02-01T00:00:00.000Z' : null }),
          accountId: 'account-1',
          configuredAssetsCount: 1,
          currentKnownBalanceUsd: '10500',
          uncoveredTradeCount: 0,
        },
      ];
    }),
  };
  const listAccountDefaultsUseCase = {
    execute: vi.fn((_accountId: string) => makeDefaults()),
  };
  const restoreAccountSnapshotUseCase = { execute: vi.fn() };
  const commands = new AccountCommands(
    history,
    createAccountUseCase,
    updateAccountUseCase,
    getAccountByIdUseCase,
    deleteAccountUseCase,
    restoreAccountUseCase,
    archiveAccountUseCase,
    listAccountsUseCase,
    listAccountDefaultsUseCase,
    restoreAccountSnapshotUseCase,
  );
  return {
    archiveAccountUseCase,
    commands,
    createAccountUseCase,
    deleteAccountUseCase,
    getAccountByIdUseCase,
    history,
    listAccountDefaultsUseCase,
    listAccountsUseCase,
    restoreAccountSnapshotUseCase,
    restoreAccountUseCase,
    state,
    updateAccountUseCase,
  };
};

describe('AccountCommands', () => {
  it('returns the projected read model after create and undoes it by deleting the same id', () => {
    const { commands, createAccountUseCase, deleteAccountUseCase, history } = createHarness();

    const outcome = commands.create({
      defaults: [],
      name: 'Main',
      openingBalanceUsd: '10000',
    });

    expect(outcome.value).toMatchObject({
      currentKnownBalanceUsd: '10500',
      id: 'account-1',
    });
    expect(outcome.changedResources).toEqual([
      DATA_RESOURCES.history,
      DATA_RESOURCES.accounts,
      DATA_RESOURCES.accountInstrumentDefaults,
    ]);
    expect(createAccountUseCase.execute).toHaveBeenCalledWith({
      defaults: [],
      name: 'Main',
      openingBalanceUsd: '10000',
    });

    history.undo();
    expect(deleteAccountUseCase.execute).toHaveBeenCalledWith('account-1');
  });

  it('restores the exact account and defaults snapshot when an update is undone', () => {
    const {
      commands,
      history,
      listAccountDefaultsUseCase,
      restoreAccountSnapshotUseCase,
      updateAccountUseCase,
    } = createHarness();
    const input: UpdateTradingAccountInput = {
      defaults: [],
      id: 'account-1',
      name: 'Renamed',
      openingBalanceUsd: '12000',
    };

    commands.update(input);
    expect(listAccountDefaultsUseCase.execute).toHaveBeenCalledWith('account-1');
    expect(updateAccountUseCase.execute).toHaveBeenCalledWith(input);

    history.undo();
    expect(restoreAccountSnapshotUseCase.execute).toHaveBeenCalledWith(
      makeAccount(),
      makeDefaults(),
    );
  });

  it('unarchives an archived account on undo instead of recreating it', () => {
    const { commands, history, restoreAccountSnapshotUseCase, restoreAccountUseCase } =
      createHarness();

    commands.delete('account-1');
    history.undo();

    expect(restoreAccountUseCase.execute).toHaveBeenCalledWith('account-1');
    expect(restoreAccountSnapshotUseCase.execute).not.toHaveBeenCalled();
  });

  it('restores a physically deleted account from its snapshot on undo', () => {
    const { commands, history, restoreAccountSnapshotUseCase, restoreAccountUseCase, state } =
      createHarness();
    state.deleted = true;

    commands.delete('account-1');
    history.undo();

    expect(restoreAccountUseCase.execute).not.toHaveBeenCalled();
    expect(restoreAccountSnapshotUseCase.execute).toHaveBeenCalledWith(
      makeAccount(),
      makeDefaults(),
    );
  });

  it('archives a restored account on undo', () => {
    const { archiveAccountUseCase, commands, history, restoreAccountUseCase } = createHarness();

    commands.restore('account-1');
    expect(restoreAccountUseCase.execute).toHaveBeenCalledWith('account-1');

    history.undo();
    expect(archiveAccountUseCase.execute).toHaveBeenCalledWith('account-1');
  });

  it('refuses to update an unknown account without touching history', () => {
    const { commands, history, updateAccountUseCase } = createHarness();

    expect(() =>
      commands.update({ defaults: [], id: 'missing', name: 'X', openingBalanceUsd: '1' }),
    ).toThrow('Account not found.');
    expect(updateAccountUseCase.execute).not.toHaveBeenCalled();
    expect(history.getState().canUndo).toBe(false);
  });
});
