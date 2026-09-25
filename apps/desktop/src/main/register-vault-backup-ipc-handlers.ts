import { ipcMain } from 'electron';
import { z } from 'zod';

import type {
  CreateVaultBackupUseCase,
  JournalStorage,
  ListVaultBackupsUseCase,
  RestoreVaultBackupUseCase,
  VaultLocationPicker,
  VerifyVaultBackupUseCase,
} from '@tjournal/journal';
import { AppError } from '@tjournal/platform-errors';

import { IPC_CHANNELS } from '../shared/ipc-channels';
import { asAsyncResult, asResult } from './ipc-result';
import type { IpcRegistrationContext } from './ipc-registration-context';

const backupIdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f-]{36}$/);

export interface VaultBackupIpcDependencies {
  readonly createVaultBackupUseCase: Pick<CreateVaultBackupUseCase, 'execute'>;
  readonly listVaultBackupsUseCase: Pick<ListVaultBackupsUseCase, 'execute'>;
  readonly verifyVaultBackupUseCase: Pick<VerifyVaultBackupUseCase, 'execute'>;
  readonly restoreVaultBackupUseCase: Pick<RestoreVaultBackupUseCase, 'execute'>;
  readonly journalStorage: Pick<JournalStorage, 'getStatus'>;
  readonly vaultLocationPicker: Pick<VaultLocationPicker, 'pickDirectory'>;
}

const activePath = (storage: Pick<JournalStorage, 'getStatus'>): string => {
  const status = storage.getStatus();
  if (!status.isOpen || status.path === null) {
    throw new AppError({ code: 'vault-not-accessible', message: 'No active vault.' });
  }
  return status.path;
};

const parseId = (value: unknown): string => {
  const result = backupIdSchema.safeParse(value);
  if (!result.success)
    throw new AppError({ code: 'backup-invalid', message: 'Invalid backup ID.' });
  return result.data;
};

export const registerVaultBackupIpcHandlers = (
  dependencies: VaultBackupIpcDependencies,
  context: IpcRegistrationContext,
): void => {
  ipcMain.handle(IPC_CHANNELS.vaultBackup, () =>
    asAsyncResult(
      async () => {
        const result = await dependencies.createVaultBackupUseCase.execute(
          activePath(dependencies.journalStorage),
          'manual',
        );
        return result;
      },
      context.logger,
      'ipc.vault-backup.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.vaultBackups, (_event, beforeId: unknown) =>
    asResult(
      () =>
        dependencies.listVaultBackupsUseCase.execute(
          activePath(dependencies.journalStorage),
          beforeId === undefined || beforeId === null ? null : parseId(beforeId),
        ),
      context.logger,
      'ipc.vault-backups.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.vaultBackupVerify, (_event, id: unknown) =>
    asResult(
      () =>
        dependencies.verifyVaultBackupUseCase.execute(
          activePath(dependencies.journalStorage),
          parseId(id),
        ),
      context.logger,
      'ipc.vault-backup-verify.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.vaultBackupRestore, (_event, id: unknown) =>
    asAsyncResult(
      async () => {
        const source = activePath(dependencies.journalStorage);
        const backupId = parseId(id);
        dependencies.verifyVaultBackupUseCase.execute(source, backupId);
        const destination = await dependencies.vaultLocationPicker.pickDirectory();
        if (destination === null) return null;
        const started = Date.now();
        const path = await dependencies.restoreVaultBackupUseCase.execute(
          source,
          backupId,
          destination,
        );
        context.logger.info('vault.backup-restored', { durationMs: String(Date.now() - started) });
        return { path };
      },
      context.logger,
      'ipc.vault-backup-restore.failed',
    ),
  );
};
