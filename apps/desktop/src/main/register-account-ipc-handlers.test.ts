import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ipcMainMock } = vi.hoisted(() => ({ ipcMainMock: { handle: vi.fn() } }));
vi.mock('electron', () => ({ ipcMain: ipcMainMock }));

import type { AccountDto, CashMovementDto, IpcResult } from '../shared/desktop-api';
import { DATA_RESOURCES } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { registerAccountIpcHandlers } from './register-account-ipc-handlers';
import { createIpcTestHarness } from './testing/ipc-test-harness';

const ACCOUNT: AccountDto = {
  archivedAt: null,
  configuredAssetsCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  currentKnownBalanceUsd: '10000',
  defaultRiskUsd: null,
  id: 'account-1',
  name: 'Main',
  openingBalanceUsd: '10000',
  uncoveredTradeCount: 0,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const MOVEMENT: CashMovementDto = {
  accountId: 'account-1',
  accountName: 'Main',
  amountUsd: '500',
  id: 'movement-1',
  kind: 'deposit',
  occurredAt: '2026-01-01T00:00:00.000Z',
};

const createDependencies = () => ({
  accountCommands: {
    create: vi.fn(() => ({
      changedResources: [
        DATA_RESOURCES.history,
        DATA_RESOURCES.accounts,
        DATA_RESOURCES.accountInstrumentDefaults,
      ],
      value: ACCOUNT,
    })),
    delete: vi.fn(() => ({
      changedResources: [
        DATA_RESOURCES.history,
        DATA_RESOURCES.accounts,
        DATA_RESOURCES.accountInstrumentDefaults,
      ],
      value: ACCOUNT,
    })),
    restore: vi.fn(() => ({
      changedResources: [DATA_RESOURCES.history, DATA_RESOURCES.accounts],
      value: ACCOUNT,
    })),
    update: vi.fn(() => ({
      changedResources: [
        DATA_RESOURCES.history,
        DATA_RESOURCES.accounts,
        DATA_RESOURCES.accountInstrumentDefaults,
      ],
      value: ACCOUNT,
    })),
  },
  cashMovementCommands: {
    create: vi.fn(() => ({
      changedResources: [
        DATA_RESOURCES.history,
        DATA_RESOURCES.accounts,
        DATA_RESOURCES.cashMovements,
      ],
      value: MOVEMENT,
    })),
    delete: vi.fn(() => ({
      changedResources: [
        DATA_RESOURCES.history,
        DATA_RESOURCES.accounts,
        DATA_RESOURCES.cashMovements,
      ],
      value: MOVEMENT,
    })),
    update: vi.fn(() => ({
      changedResources: [
        DATA_RESOURCES.history,
        DATA_RESOURCES.accounts,
        DATA_RESOURCES.cashMovements,
      ],
      value: MOVEMENT,
    })),
  },
  listAccountDefaultsUseCase: { execute: vi.fn(() => []) },
  listAccountsUseCase: { execute: vi.fn(() => [{ ...ACCOUNT, accountId: 'account-1' }]) },
  listCashMovementsUseCase: { execute: vi.fn(() => [MOVEMENT]) },
});

describe('registerAccountIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers exactly the documented account and cash-movement channels', () => {
    const harness = createIpcTestHarness();
    registerAccountIpcHandlers(createDependencies(), harness.context);

    expect([...harness.registeredChannels()].sort()).toEqual(
      [
        IPC_CHANNELS.accountsCreate,
        IPC_CHANNELS.accountsDefaults,
        IPC_CHANNELS.accountsDelete,
        IPC_CHANNELS.accountsList,
        IPC_CHANNELS.accountsRestore,
        IPC_CHANNELS.accountsUpdate,
        IPC_CHANNELS.cashMovementsCreate,
        IPC_CHANNELS.cashMovementsDelete,
        IPC_CHANNELS.cashMovementsList,
        IPC_CHANNELS.cashMovementsUpdate,
      ].sort(),
    );
  });

  it('reads account defaults through the point use case', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerAccountIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<readonly unknown[]>>(
      IPC_CHANNELS.accountsDefaults,
      'account-1',
    );

    expect(dependencies.listAccountDefaultsUseCase.execute).toHaveBeenCalledWith('account-1');
    expect(result).toEqual({ ok: true, value: [] });
  });

  it('delegates a parsed account to the command and publishes its resources', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerAccountIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<AccountDto>>(IPC_CHANNELS.accountsCreate, {
      defaults: [],
      name: 'Main',
      openingBalanceUsd: '10000',
    });

    expect(dependencies.accountCommands.create).toHaveBeenCalledWith({
      defaults: [],
      name: 'Main',
      openingBalanceUsd: '10000',
    });
    expect(result).toEqual({ ok: true, value: ACCOUNT });
    expect(harness.capture).toHaveBeenCalledWith([
      DATA_RESOURCES.history,
      DATA_RESOURCES.accounts,
      DATA_RESOURCES.accountInstrumentDefaults,
    ]);
  });

  it('delegates a parsed cash movement to its command', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerAccountIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<CashMovementDto>>(
      IPC_CHANNELS.cashMovementsCreate,
      {
        accountId: 'account-1',
        amountUsd: '500',
        kind: 'deposit',
        occurredAt: '2026-01-01T00:00:00.000Z',
      },
    );

    expect(dependencies.cashMovementCommands.create).toHaveBeenCalledWith({
      accountId: 'account-1',
      amountUsd: '500',
      kind: 'deposit',
      occurredAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result).toEqual({ ok: true, value: MOVEMENT });
    expect(harness.capture).toHaveBeenCalledWith([
      DATA_RESOURCES.history,
      DATA_RESOURCES.accounts,
      DATA_RESOURCES.cashMovements,
    ]);
  });

  it('never invokes a command for an invalid cash movement payload', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerAccountIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<CashMovementDto>>(
      IPC_CHANNELS.cashMovementsCreate,
      {
        accountId: 'account-1',
        amountUsd: '0',
        kind: 'deposit',
        occurredAt: '2026-01-01T00:00:00.000Z',
      },
    );

    expect(result.ok).toBe(false);
    expect(dependencies.cashMovementCommands.create).not.toHaveBeenCalled();
    expect(harness.capture).not.toHaveBeenCalled();
  });
});
