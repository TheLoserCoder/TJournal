import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ipcMainMock } = vi.hoisted(() => ({ ipcMainMock: { handle: vi.fn() } }));
vi.mock('electron', () => ({ ipcMain: ipcMainMock }));

import { IPC_CHANNELS } from '../shared/ipc-channels';
import { registerVaultBackupIpcHandlers } from './register-vault-backup-ipc-handlers';
import { createIpcTestHarness } from './testing/ipc-test-harness';

const BACKUP = {
  id: '2026-09-23T12-30-00-000Z-00000000-0000-4000-8000-000000000000',
  kind: 'manual' as const,
  createdAt: '2026-09-23T12:30:00.000Z',
  databaseBytes: 8192,
  sourceVaultId: '00000000-0000-4000-8000-000000000001',
};

const dependencies = () => ({
  createVaultBackupUseCase: { execute: vi.fn(async () => BACKUP) },
  listVaultBackupsUseCase: { execute: vi.fn(() => ({ backups: [BACKUP], nextCursor: null })) },
  verifyVaultBackupUseCase: { execute: vi.fn(() => BACKUP) },
  restoreVaultBackupUseCase: { execute: vi.fn(async () => 'C:/restored') },
  journalStorage: { getStatus: vi.fn(() => ({ isOpen: true, path: 'C:/active' })) },
  vaultLocationPicker: { pickDirectory: vi.fn(async (): Promise<string | null> => 'C:/restored') },
});

describe('vault backup IPC', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers four typed channels and never publishes a data revision', async () => {
    const harness = createIpcTestHarness();
    const ports = dependencies();
    registerVaultBackupIpcHandlers(ports, harness.context);
    expect([...harness.registeredChannels()].sort()).toEqual(
      [
        IPC_CHANNELS.vaultBackup,
        IPC_CHANNELS.vaultBackups,
        IPC_CHANNELS.vaultBackupVerify,
        IPC_CHANNELS.vaultBackupRestore,
      ].sort(),
    );
    expect(await harness.invoke(IPC_CHANNELS.vaultBackup)).toEqual({ ok: true, value: BACKUP });
    expect(ports.createVaultBackupUseCase.execute).toHaveBeenCalledWith('C:/active', 'manual');
    expect(await harness.invoke(IPC_CHANNELS.vaultBackups)).toEqual({
      ok: true,
      value: { backups: [BACKUP], nextCursor: null },
    });
    expect(harness.publish).not.toHaveBeenCalled();
  });

  it('rejects arbitrary renderer paths/IDs before showing the destination picker', async () => {
    const harness = createIpcTestHarness();
    const ports = dependencies();
    registerVaultBackupIpcHandlers(ports, harness.context);
    expect(
      await harness.invoke(IPC_CHANNELS.vaultBackupRestore, '../journal.sqlite'),
    ).toMatchObject({ ok: false, error: { code: 'backup-invalid' } });
    expect(ports.vaultLocationPicker.pickDirectory).not.toHaveBeenCalled();
    expect(ports.restoreVaultBackupUseCase.execute).not.toHaveBeenCalled();
  });

  it('preserves the current vault when the restore picker is cancelled', async () => {
    const harness = createIpcTestHarness();
    const ports = dependencies();
    ports.vaultLocationPicker.pickDirectory.mockResolvedValue(null);
    registerVaultBackupIpcHandlers(ports, harness.context);
    expect(await harness.invoke(IPC_CHANNELS.vaultBackupRestore, BACKUP.id)).toEqual({
      ok: true,
      value: null,
    });
    expect(ports.restoreVaultBackupUseCase.execute).not.toHaveBeenCalled();
    expect(harness.publish).not.toHaveBeenCalled();
  });
});
