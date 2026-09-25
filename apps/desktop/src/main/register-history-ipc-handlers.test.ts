import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ipcMainMock } = vi.hoisted(() => ({ ipcMainMock: { handle: vi.fn() } }));
vi.mock('electron', () => ({ ipcMain: ipcMainMock }));

import type { HistoryStateDto, IpcResult } from '../shared/desktop-api';
import { DATA_RESOURCES } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { UndoRedoHistory } from './history/undo-redo-history';
import { registerHistoryIpcHandlers } from './register-history-ipc-handlers';
import { createIpcTestHarness } from './testing/ipc-test-harness';

const createDependencies = () => ({ history: new UndoRedoHistory() });

describe('registerHistoryIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers exactly the documented history channels', () => {
    const harness = createIpcTestHarness();
    registerHistoryIpcHandlers(createDependencies(), harness.context);

    expect([...harness.registeredChannels()].sort()).toEqual(
      [IPC_CHANNELS.historyGetState, IPC_CHANNELS.historyRedo, IPC_CHANNELS.historyUndo].sort(),
    );
  });

  it('returns the current state without publishing changes', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerHistoryIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<HistoryStateDto>>(IPC_CHANNELS.historyGetState);

    expect(result).toEqual({
      ok: true,
      value: { canRedo: false, canUndo: false, redoLabel: null, undoLabel: null },
    });
    expect(harness.capture).not.toHaveBeenCalled();
  });

  it('publishes the history resource only when undo changed something', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    dependencies.history.execute({
      execute: () => undefined,
      label: 'trade.create',
      undo: () => undefined,
    });
    registerHistoryIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<HistoryStateDto>>(IPC_CHANNELS.historyUndo);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a successful undo.');
    expect(result.value).toMatchObject({
      canRedo: true,
      canUndo: false,
      redoLabel: 'trade.create',
    });
    expect(harness.capture).toHaveBeenCalledWith([DATA_RESOURCES.history]);

    const empty = await harness.invoke<IpcResult<HistoryStateDto>>(IPC_CHANNELS.historyUndo);
    expect(empty).toEqual({
      ok: true,
      value: { canRedo: true, canUndo: false, redoLabel: 'trade.create', undoLabel: null },
    });
  });

  it('keeps a failed inverse retryable and reports a safe error', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    dependencies.history.execute({
      execute: () => undefined,
      label: 'trade.create',
      undo: () => {
        throw new Error('inverse failed');
      },
    });
    registerHistoryIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<HistoryStateDto>>(IPC_CHANNELS.historyUndo);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a failed undo.');
    expect(result.error.code).toBe('unexpected');
    expect(harness.capture).not.toHaveBeenCalled();
    expect(dependencies.history.getState().canUndo).toBe(true);
    expect(harness.logger.error).toHaveBeenCalledWith(
      'ipc.history-undo.failed',
      expect.objectContaining({ code: 'unexpected' }),
    );
  });
});
