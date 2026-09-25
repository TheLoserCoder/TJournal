import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ipcMainMock } = vi.hoisted(() => ({ ipcMainMock: { handle: vi.fn() } }));
vi.mock('electron', () => ({ ipcMain: ipcMainMock }));

import type { CommittedDataChangeDto, IpcResult, VaultDto } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { registerVaultIpcHandlers } from './register-vault-ipc-handlers';
import { createIpcTestHarness } from './testing/ipc-test-harness';

const CHANGE: CommittedDataChangeDto = {
  changeId: 'change-1',
  resources: [],
  revisions: {},
  vaultGeneration: 'generation-1',
};

const DESCRIPTOR = {
  createdAt: '2026-01-01T00:00:00.000Z',
  formatVersion: 1,
  path: 'C:/vault-a',
  vaultId: 'vault-a',
};

const createDependencies = (options: { readonly isOpen?: boolean } = {}) => ({
  inspectVaultUseCase: { execute: vi.fn(() => DESCRIPTOR) },
  journalStorage: {
    getStatus: vi.fn(() => ({ isOpen: options.isOpen ?? true, path: 'C:/vault-a' })),
  },
  vaultFolderOpener: { revealDirectory: vi.fn(async () => undefined) },
  vaultLocationPicker: { pickDirectory: vi.fn(async (): Promise<string | null> => 'C:/vault-b') },
  vaultSessionCoordinator: {
    create: vi.fn(() => ({ change: CHANGE, path: 'C:/vault-b' })),
    open: vi.fn(async () => ({ change: CHANGE, path: 'C:/vault-b' })),
  },
});

describe('registerVaultIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers exactly the documented vault channels', () => {
    const harness = createIpcTestHarness();
    registerVaultIpcHandlers(createDependencies(), harness.context);

    expect([...harness.registeredChannels()].sort()).toEqual(
      [
        IPC_CHANNELS.vaultCreate,
        IPC_CHANNELS.vaultOpen,
        IPC_CHANNELS.vaultRevealInFolder,
        IPC_CHANNELS.vaultValidate,
      ].sort(),
    );
  });

  it('returns null without activating a vault when the picker is dismissed', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    dependencies.vaultLocationPicker.pickDirectory.mockResolvedValue(null);
    registerVaultIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<VaultDto | null>>(IPC_CHANNELS.vaultOpen);

    expect(result).toEqual({ ok: true, value: null });
    expect(dependencies.vaultSessionCoordinator.open).not.toHaveBeenCalled();
    expect(harness.publish).not.toHaveBeenCalled();
  });

  it('activates the picked vault and publishes the activation change', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerVaultIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<VaultDto | null>>(IPC_CHANNELS.vaultOpen);

    expect(dependencies.vaultSessionCoordinator.open).toHaveBeenCalledWith('C:/vault-b');
    expect(result).toEqual({ ok: true, value: { path: 'C:/vault-b' } });
    expect(harness.publish).toHaveBeenCalledWith(CHANGE);
    expect(harness.logger.info).toHaveBeenCalledWith('vault.opened');
  });

  it('returns a safe error and logs when the native picker fails', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    dependencies.vaultLocationPicker.pickDirectory.mockRejectedValue(new Error('native failure'));
    registerVaultIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<VaultDto | null>>(IPC_CHANNELS.vaultOpen);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a safe picker error.');
    expect(result.error.code).toBe('unexpected');
    expect(harness.logger.error).toHaveBeenCalledWith(
      'ipc.vault-open.failed',
      expect.objectContaining({ code: 'unexpected', detail: 'native failure' }),
    );
    expect(dependencies.vaultSessionCoordinator.open).not.toHaveBeenCalled();
  });

  it('rejects validation without an active vault', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies({ isOpen: false });
    registerVaultIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<VaultDto>>(IPC_CHANNELS.vaultValidate);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a vault error.');
    expect(result.error.code).toBe('vault-not-accessible');
    expect(dependencies.inspectVaultUseCase.execute).not.toHaveBeenCalled();
  });

  it('validates and reveals the active vault path', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerVaultIpcHandlers(dependencies, harness.context);

    const validated = await harness.invoke<IpcResult<VaultDto>>(IPC_CHANNELS.vaultValidate);
    const revealed = await harness.invoke<IpcResult<VaultDto>>(IPC_CHANNELS.vaultRevealInFolder);

    expect(validated).toEqual({ ok: true, value: { path: 'C:/vault-a' } });
    expect(revealed).toEqual({ ok: true, value: { path: 'C:/vault-a' } });
    expect(dependencies.inspectVaultUseCase.execute).toHaveBeenCalledWith('C:/vault-a');
    expect(dependencies.vaultFolderOpener.revealDirectory).toHaveBeenCalledWith('C:/vault-a');
  });
});
