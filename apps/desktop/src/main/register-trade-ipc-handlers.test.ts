import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ipcMainMock } = vi.hoisted(() => ({ ipcMainMock: { handle: vi.fn() } }));
vi.mock('electron', () => ({ ipcMain: ipcMainMock }));

import type { IpcResult, TradeDto, TradePreferencesDto } from '../shared/desktop-api';
import { MAX_TRADE_NOTE_CODE_POINTS } from '@tjournal/trade';
import { DATA_RESOURCES } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { registerTradeIpcHandlers } from './register-trade-ipc-handlers';
import { createIpcTestHarness } from './testing/ipc-test-harness';

const TRADE: TradeDto = {
  closedAt: '2026-01-01T00:00:00.000Z',
  direction: 'long',
  entryNote: null,
  execution: null,
  id: 'trade-1',
  instrumentId: 'instrument-1',
  instrumentSymbol: 'ES',
  resultKind: 'cash',
  resultSource: 'manual',
  resultValue: '100',
  reviewNote: null,
  reviewStatus: 'unreviewed',
  riskBindingSnapshot: null,
  tagIds: [],
};

const PREFERENCES: TradePreferencesDto = {
  neutralCostSettings: { includeCommission: true, includeSpread: false },
  neutralRanges: { cash: null, percent: null, r: null },
  riskBinding: null,
  riskPromptDismissed: false,
};

const createDependencies = () => ({
  commands: {
    create: vi.fn(() => ({
      changedResources: [DATA_RESOURCES.history, DATA_RESOURCES.trades],
      value: TRADE,
    })),
    delete: vi.fn(() => ({ changedResources: [DATA_RESOURCES.history], value: TRADE })),
    deleteMany: vi.fn(() => ({
      changedResources: [DATA_RESOURCES.history],
      value: [TRADE],
    })),
    update: vi.fn(() => ({
      changedResources: [DATA_RESOURCES.history, DATA_RESOURCES.trades],
      value: TRADE,
    })),
  },
  getTradeByIdUseCase: { execute: vi.fn(() => TRADE) },
  getTradePreferencesUseCase: { execute: vi.fn(() => PREFERENCES) },
  journalTableReader: { readPage: vi.fn() },
  preferencesCommands: {
    update: vi.fn(() => ({
      changedResources: [
        DATA_RESOURCES.history,
        DATA_RESOURCES.tradePreferences,
        DATA_RESOURCES.trades,
      ],
      value: PREFERENCES,
    })),
  },
});

const CREATE_TRADE_INPUT = {
  accountId: 'account-1',
  closedAt: '2026-01-01T00:00:00.000Z',
  direction: 'long',
  execution: null,
  instrumentId: 'instrument-1',
  resultKind: 'cash',
  resultValue: '100',
};

describe('registerTradeIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers exactly the documented trade channels', () => {
    const harness = createIpcTestHarness();
    registerTradeIpcHandlers(createDependencies(), harness.context);

    expect([...harness.registeredChannels()].sort()).toEqual(
      [
        IPC_CHANNELS.tradePreferencesGet,
        IPC_CHANNELS.tradePreferencesUpdate,
        IPC_CHANNELS.tradesCreate,
        IPC_CHANNELS.tradesDelete,
        IPC_CHANNELS.tradesDeleteMany,
        IPC_CHANNELS.tradesGet,
        IPC_CHANNELS.tradesPage,
        IPC_CHANNELS.tradesUpdate,
      ].sort(),
    );
  });

  it('delegates a parsed trade to the command and publishes its resources', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerTradeIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<TradeDto>>(
      IPC_CHANNELS.tradesCreate,
      CREATE_TRADE_INPUT,
    );

    expect(dependencies.commands.create).toHaveBeenCalledWith(CREATE_TRADE_INPUT);
    expect(result).toEqual({ ok: true, value: TRADE });
    expect(harness.capture).toHaveBeenCalledWith([DATA_RESOURCES.history, DATA_RESOURCES.trades]);
  });

  it('never invokes a command for an invalid payload', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerTradeIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<TradeDto>>(IPC_CHANNELS.tradesCreate, {
      ...CREATE_TRADE_INPUT,
      closedAt: 'not-a-date',
    });

    expect(result.ok).toBe(false);
    expect(dependencies.commands.create).not.toHaveBeenCalled();
    expect(harness.capture).not.toHaveBeenCalled();
  });

  it('rejects an overlong Unicode note without logging its contents', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerTradeIpcHandlers(dependencies, harness.context);
    const rejectedNote = '😀'.repeat(MAX_TRADE_NOTE_CODE_POINTS + 1);

    const result = await harness.invoke<IpcResult<TradeDto>>(IPC_CHANNELS.tradesCreate, {
      ...CREATE_TRADE_INPUT,
      entryNote: rejectedNote,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues).toContainEqual({ code: 'note-too-long', path: 'entryNote' });
    }
    expect(dependencies.commands.create).not.toHaveBeenCalled();
    expect(harness.logger.error.mock.calls.join(' ')).not.toContain(rejectedNote);
  });

  it('delegates preference updates with the parsed rebind flag', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerTradeIpcHandlers(dependencies, harness.context);

    await harness.invoke<IpcResult<TradePreferencesDto>>(IPC_CHANNELS.tradePreferencesUpdate, {
      preferences: PREFERENCES,
      rebindHistorical: true,
    });

    expect(dependencies.preferencesCommands.update).toHaveBeenCalledWith({
      preferences: PREFERENCES,
      rebindHistorical: true,
    });
    expect(harness.capture).toHaveBeenCalledWith([
      DATA_RESOURCES.history,
      DATA_RESOURCES.tradePreferences,
      DATA_RESOURCES.trades,
    ]);
  });
});
