import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ipcMainMock } = vi.hoisted(() => ({ ipcMainMock: { handle: vi.fn() } }));
vi.mock('electron', () => ({ ipcMain: ipcMainMock }));

import type { AppDiagnosticsDto, IpcResult } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { registerDiagnosticsIpcHandlers } from './register-diagnostics-ipc-handlers';
import { createIpcTestHarness } from './testing/ipc-test-harness';

const createDependencies = () => ({
  appName: 'TJournal',
  appVersion: '0.1.0',
  applicationPaths: { logsDirectory: 'C:/logs' },
  journalStorage: { getStatus: vi.fn(() => ({ isOpen: true, path: 'C:/vault-a' })) },
});

describe('registerDiagnosticsIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers exactly the documented diagnostics channel', () => {
    const harness = createIpcTestHarness();
    registerDiagnosticsIpcHandlers(createDependencies(), harness.context);

    expect(harness.registeredChannels()).toEqual([IPC_CHANNELS.diagnosticsGetStatus]);
  });

  it('reports the application paths and the active vault', async () => {
    const harness = createIpcTestHarness();
    registerDiagnosticsIpcHandlers(createDependencies(), harness.context);

    const result = await harness.invoke<IpcResult<AppDiagnosticsDto>>(
      IPC_CHANNELS.diagnosticsGetStatus,
    );

    expect(result).toEqual({
      ok: true,
      value: {
        appName: 'TJournal',
        appVersion: '0.1.0',
        logsDirectory: 'C:/logs',
        vaultPath: 'C:/vault-a',
      },
    });
  });
});
