import { ipcMain } from 'electron';

import type {
  InspectVaultUseCase,
  JournalStorage,
  VaultFolderOpener,
  VaultLocationPicker,
} from '@tjournal/journal';
import { AppError } from '@tjournal/platform-errors';

import { IPC_CHANNELS } from '../shared/ipc-channels';
import { asAsyncResult, asResult } from './ipc-result';
import type { IpcRegistrationContext } from './ipc-registration-context';
import type { VaultSessionCoordinator } from './vault-session-coordinator';

export interface VaultIpcDependencies {
  readonly inspectVaultUseCase: Pick<InspectVaultUseCase, 'execute'>;
  readonly journalStorage: Pick<JournalStorage, 'getStatus'>;
  readonly vaultFolderOpener: Pick<VaultFolderOpener, 'revealDirectory'>;
  readonly vaultLocationPicker: Pick<VaultLocationPicker, 'pickDirectory'>;
  readonly vaultSessionCoordinator: Pick<VaultSessionCoordinator, 'create' | 'open'>;
}

const requireActiveVaultPath = (journalStorage: Pick<JournalStorage, 'getStatus'>): string => {
  const status = journalStorage.getStatus();
  if (!status.isOpen || status.path === null) {
    throw new AppError({
      code: 'vault-not-accessible',
      message: 'No active vault is open.',
    });
  }
  return status.path;
};

export const registerVaultIpcHandlers = (
  dependencies: VaultIpcDependencies,
  context: IpcRegistrationContext,
): void => {
  ipcMain.handle(IPC_CHANNELS.vaultCreate, () =>
    asAsyncResult(
      async () => {
        const vaultPath = await dependencies.vaultLocationPicker.pickDirectory();
        if (vaultPath === null) return null;
        const activation = dependencies.vaultSessionCoordinator.create(vaultPath);
        context.logger.info('vault.created');
        context.publish(activation.change);
        return { path: activation.path };
      },
      context.logger,
      'ipc.vault-create.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.vaultOpen, () =>
    asAsyncResult(
      async () => {
        const vaultPath = await dependencies.vaultLocationPicker.pickDirectory();
        if (vaultPath === null) return null;
        const activation = await dependencies.vaultSessionCoordinator.open(vaultPath);
        context.logger.info('vault.opened');
        context.publish(activation.change);
        return { path: activation.path };
      },
      context.logger,
      'ipc.vault-open.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.vaultValidate, () =>
    asResult(
      () => {
        const vaultPath = requireActiveVaultPath(dependencies.journalStorage);
        const descriptor = dependencies.inspectVaultUseCase.execute(vaultPath);
        context.logger.info('vault.validated');
        return { path: descriptor.path };
      },
      context.logger,
      'ipc.vault-validate.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.vaultRevealInFolder, () =>
    asAsyncResult(
      async () => {
        const vaultPath = requireActiveVaultPath(dependencies.journalStorage);
        await dependencies.vaultFolderOpener.revealDirectory(vaultPath);
        context.logger.info('vault.revealed');
        return { path: vaultPath };
      },
      context.logger,
      'ipc.vault-reveal.failed',
    ),
  );
};
