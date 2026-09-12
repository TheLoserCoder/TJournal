import { ipcMain } from 'electron';

import { toSafeAppError } from '@tjournal/platform-errors';
import type { Logger } from '@tjournal/platform-observability';
import type { CreateTradeDto, IpcResult, TradeDto } from '../shared/desktop-api';
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
      () => {
        let created: TradeDto | null = null;
        return dependencies.history.execute({
          execute: () => {
            created = dependencies.createTradeUseCase.execute(input, created?.id);
            return created;
          },
          label: 'trade.create',
          undo: () => {
            if (created !== null) dependencies.deleteTradeUseCase.execute(created.id);
          },
        });
      },
      logger,
      'ipc.trade-create.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradesUpdate, (_event, input: TradeDto) =>
    asResult(
      () => {
        const previous = dependencies.listTradesUseCase
          .execute()
          .find((trade) => trade.id === input.id);
        if (previous === undefined) throw new Error('Trade not found.');
        return dependencies.history.execute({
          execute: () => dependencies.updateTradeUseCase.execute(input),
          label: 'trade.update',
          undo: () => {
            dependencies.updateTradeUseCase.execute(previous);
          },
        });
      },
      logger,
      'ipc.trade-update.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradesDelete, (_event, id: string) =>
    asResult(
      () => {
        const previous = dependencies.listTradesUseCase.execute().find((trade) => trade.id === id);
        if (previous === undefined) throw new Error('Trade not found.');
        return dependencies.history.execute({
          execute: () => dependencies.deleteTradeUseCase.execute(id),
          label: 'trade.delete',
          undo: () => {
            dependencies.createTradeUseCase.execute(
              {
                closedAt: previous.closedAt,
                instrumentId: previous.instrumentId,
                resultKind: previous.resultKind,
                resultValue: previous.resultValue,
              },
              previous.id,
            );
          },
        });
      },
      logger,
      'ipc.trade-delete.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradesList, () =>
    asResult(() => dependencies.listTradesUseCase.execute(), logger, 'ipc.trades-list.failed'),
  );

  ipcMain.handle(IPC_CHANNELS.instrumentsList, () =>
    asResult(
      () => dependencies.listInstrumentsUseCase.execute(),
      logger,
      'ipc.instruments-list.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.instrumentsCreate, (_event, input) =>
    asResult(
      () => {
        let created: ReturnType<typeof dependencies.createInstrumentUseCase.execute> | null = null;
        return dependencies.history.execute({
          execute: () => {
            created = dependencies.createInstrumentUseCase.execute(input, created?.id);
            return created;
          },
          label: 'instrument.create',
          undo: () => {
            if (created !== null) dependencies.deleteInstrumentUseCase.execute(created.id);
          },
        });
      },
      logger,
      'ipc.instrument-create.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.historyGetState, () =>
    asResult(() => dependencies.history.getState(), logger, 'ipc.history-get.failed'),
  );
  ipcMain.handle(IPC_CHANNELS.historyUndo, () =>
    asResult(
      () => {
        dependencies.history.undo();
        return dependencies.history.getState();
      },
      logger,
      'ipc.history-undo.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.historyRedo, () =>
    asResult(
      () => {
        dependencies.history.redo();
        return dependencies.history.getState();
      },
      logger,
      'ipc.history-redo.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.settingsGet, () =>
    asResult(
      () => dependencies.recentVaultPreferences.getSettings(),
      logger,
      'ipc.settings-get.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.settingsUpdate, (_event, settings) =>
    asResult(
      () => dependencies.recentVaultPreferences.updateSettings(settings),
      logger,
      'ipc.settings-update.failed',
    ),
  );
};
