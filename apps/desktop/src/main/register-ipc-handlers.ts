import { ipcMain } from 'electron';

import { toSafeAppError } from '@tjournal/platform-errors';
import type { Logger } from '@tjournal/platform-observability';
import type { CreateTradeDto, IpcResult } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';

import type { DesktopDependencies } from './desktop-container';

const asResult = <T>(operation: () => T, logger: Logger, event: string): IpcResult<T> => {
  try {
    return { ok: true, value: operation() };
  } catch (error) {
    const safeError = toSafeAppError(error);
    logger.error(event, { code: safeError.code });
    return { error: safeError, ok: false };
  }
};

export const registerIpcHandlers = (
  dependencies: DesktopDependencies,
  appName: string,
  appVersion: string,
): void => {
  const logger = dependencies.logger;

  ipcMain.handle(IPC_CHANNELS.diagnosticsGetStatus, () =>
    asResult(
      () => ({
        appName,
        appVersion,
        logsDirectory: dependencies.applicationPaths.logsDirectory,
        vaultPath: dependencies.journalStorage.getStatus().path,
      }),
      logger,
      'ipc.diagnostics.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.vaultCreate, async () => {
    const vaultPath = await dependencies.vaultLocationPicker.pickDirectory();
    if (vaultPath === null) {
      return { ok: true, value: null };
    }

    return asResult(
      () => {
        const vault = dependencies.createVaultUseCase.execute(vaultPath);
        dependencies.recentVaultPreferences.setLastVaultPath(vault.path);
        logger.info('vault.created');
        return { path: vault.path };
      },
      logger,
      'ipc.vault-create.failed',
    );
  });

  ipcMain.handle(IPC_CHANNELS.vaultOpen, async () => {
    const vaultPath = await dependencies.vaultLocationPicker.pickDirectory();
    if (vaultPath === null) {
      return { ok: true, value: null };
    }

    return asResult(
      () => {
        const vault = dependencies.openVaultUseCase.execute(vaultPath);
        dependencies.checkVaultIntegrityUseCase.execute();
        dependencies.recentVaultPreferences.setLastVaultPath(vault.path);
        logger.info('vault.opened');
        return { path: vault.path };
      },
      logger,
      'ipc.vault-open.failed',
    );
  });

  ipcMain.handle(IPC_CHANNELS.tradesCreate, (_event, input: CreateTradeDto) =>
    asResult(
      () => dependencies.createTradeUseCase.execute(input),
      logger,
      'ipc.trade-create.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradesList, () =>
    asResult(() => dependencies.listTradesUseCase.execute(), logger, 'ipc.trades-list.failed'),
  );
};
