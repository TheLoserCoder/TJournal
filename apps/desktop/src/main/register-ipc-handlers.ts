import { BrowserWindow, ipcMain } from 'electron';

import { AppError, toSafeAppError } from '@tjournal/platform-errors';
import type { Logger } from '@tjournal/platform-observability';
import { TradeValidationError } from '@tjournal/trade';
import {
  DATA_RESOURCES,
  type CommittedDataChangeDto,
  type CreateTradeDto,
  type CreateAccountDto,
  type CreateCashMovementDto,
  type UpdateAccountDto,
  type UpdateCashMovementDto,
  type UpdateInstrumentDto,
  type DataResource,
  type IpcResult,
  type TradeDto,
} from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import {
  createTradeSchema,
  createInstrumentSchema,
  updateInstrumentSchema,
  createAccountSchema,
  updateAccountSchema,
  instrumentProfileSchema,
  instrumentIdSchema,
  tradeIdSchema,
  tradeIdsSchema,
  summaryPreferencesSchema,
  updateTradePreferencesSchema,
  updateTradeSchema,
  cashMovementSchema,
  updateCashMovementSchema,
  accountIdSchema,
  tradeIdSchema as cashMovementIdSchema,
} from '../shared/trade-ipc-schemas';

import type { DesktopDependencies } from './desktop-container';
import { parseIpcInput } from './parse-ipc-input';
import { applicationSettingsSchema } from '../shared/application-settings';

const asResult = <T>(operation: () => T, logger: Logger, event: string): IpcResult<T> => {
  try {
    return { ok: true, value: operation() };
  } catch (error) {
    const normalizedError =
      error instanceof TradeValidationError
        ? new AppError({ code: 'validation-invalid', issues: error.issues, message: error.message })
        : error;
    const safeError = toSafeAppError(normalizedError);
    logger.error(event, {
      code: safeError.code,
      ...(normalizedError instanceof Error ? { detail: normalizedError.message } : {}),
      ...(safeError.issues === undefined ? {} : { issues: JSON.stringify(safeError.issues) }),
    });
    return { error: safeError, ok: false };
  }
};

const asAsyncResult = async <T>(
  operation: () => Promise<T>,
  logger: Logger,
  event: string,
): Promise<IpcResult<T>> => {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    const normalizedError =
      error instanceof TradeValidationError
        ? new AppError({ code: 'validation-invalid', issues: error.issues, message: error.message })
        : error;
    const safeError = toSafeAppError(normalizedError);
    logger.error(event, {
      code: safeError.code,
      ...(normalizedError instanceof Error ? { detail: normalizedError.message } : {}),
      ...(safeError.issues === undefined ? {} : { issues: JSON.stringify(safeError.issues) }),
    });
    return { error: safeError, ok: false };
  }
};

export const registerIpcHandlers = (
  dependencies: DesktopDependencies,
  appName: string,
  appVersion: string,
): void => {
  const logger = dependencies.logger;
  const publish = (change: CommittedDataChangeDto | null): void => {
    if (change === null) return;
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.dataChanged, change);
    }
  };
  const capture = (resources: readonly DataResource[] = []): void => {
    publish(dependencies.committedChangeCoordinator.capture(resources));
  };
  const captureApplicationChange = (resources: readonly DataResource[]): void => {
    publish(dependencies.committedChangeCoordinator.captureApplicationChange(resources));
  };

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
        const change = dependencies.committedChangeCoordinator.resetForVault();
        dependencies.recentVaultPreferences.setLastVaultPath(vault.path);
        logger.info('vault.created');
        publish(change);
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
        const change = dependencies.committedChangeCoordinator.resetForVault();
        dependencies.recentVaultPreferences.setLastVaultPath(vault.path);
        logger.info('vault.opened');
        publish(change);
        return { path: vault.path };
      },
      logger,
      'ipc.vault-open.failed',
    );
  });

  ipcMain.handle(IPC_CHANNELS.tradesCreate, (_event, input: CreateTradeDto) =>
    asResult(
      () => {
        const parsedInput = parseIpcInput(createTradeSchema, input);
        let created: TradeDto | null = null;
        const result = dependencies.history.execute({
          execute: () => {
            created = dependencies.createTradeUseCase.execute(parsedInput, created?.id);
            return created;
          },
          label: 'trade.create',
          undo: () => {
            if (created !== null) dependencies.deleteTradeUseCase.execute(created.id);
          },
        });
        capture([DATA_RESOURCES.history, DATA_RESOURCES.trades]);
        return result;
      },
      logger,
      'ipc.trade-create.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradesUpdate, (_event, input: TradeDto) =>
    asResult(
      () => {
        const parsedInput = parseIpcInput(updateTradeSchema, input);
        const previous = dependencies.listTradesUseCase
          .execute()
          .find((trade) => trade.id === input.id);
        if (previous === undefined) throw new Error('Trade not found.');
        const result = dependencies.history.execute({
          execute: () => dependencies.updateTradeUseCase.execute(parsedInput),
          label: 'trade.update',
          undo: () => {
            dependencies.restoreTradeUseCase.execute(previous);
          },
        });
        capture([DATA_RESOURCES.history, DATA_RESOURCES.trades]);
        return result;
      },
      logger,
      'ipc.trade-update.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradesDelete, (_event, id: string) =>
    asResult(
      () => {
        const parsedId = parseIpcInput(tradeIdSchema, id);
        const previous = dependencies.listTradesUseCase
          .execute()
          .find((trade) => trade.id === parsedId);
        if (previous === undefined) throw new Error('Trade not found.');
        const result = dependencies.history.execute({
          execute: () => dependencies.deleteTradeUseCase.execute(parsedId),
          label: 'trade.delete',
          undo: () => {
            dependencies.restoreTradesUseCase.execute([previous]);
          },
        });
        capture([DATA_RESOURCES.history]);
        return result;
      },
      logger,
      'ipc.trade-delete.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradesDeleteMany, (_event, ids: readonly string[]) =>
    asResult(
      () => {
        const parsedIds = parseIpcInput(tradeIdsSchema, ids);
        let deleted: readonly TradeDto[] = [];
        const result = dependencies.history.execute({
          execute: () => {
            deleted = dependencies.deleteTradesUseCase.execute(parsedIds);
            return deleted;
          },
          label: 'trade.delete-many',
          undo: () => {
            dependencies.restoreTradesUseCase.execute(deleted);
          },
        });
        capture([DATA_RESOURCES.history]);
        return result;
      },
      logger,
      'ipc.trades-delete-many.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradesList, () =>
    asResult(() => dependencies.listTradesUseCase.execute(), logger, 'ipc.trades-list.failed'),
  );

  ipcMain.handle(IPC_CHANNELS.instrumentsList, () =>
    asResult(
      () => dependencies.listCatalogInstrumentsUseCase.execute(),
      logger,
      'ipc.instruments-list.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.instrumentsUpdate, (_event, input) =>
    asResult(
      () => {
        const parsed = parseIpcInput<UpdateInstrumentDto>(updateInstrumentSchema, input);
        const previous = dependencies.listCatalogInstrumentsUseCase
          .execute()
          .find((item) => item.id === parsed.id);
        if (previous === undefined) throw new Error('Instrument not found.');
        const result = dependencies.history.execute({
          execute: () => dependencies.updateCatalogInstrumentUseCase.execute(parsed),
          label: 'instrument.update',
          undo: () => {
            dependencies.updateCatalogInstrumentUseCase.execute({
              id: previous.id,
              symbol: previous.symbol,
              category: previous.category,
              calculationProfile:
                previous.calculationProfile === null
                  ? null
                  : {
                      tickSize: previous.calculationProfile.tickSize,
                      tickValueUsdPerLot: previous.calculationProfile.tickValueUsdPerLot,
                    },
            });
          },
        });
        capture([
          DATA_RESOURCES.history,
          DATA_RESOURCES.instruments,
          DATA_RESOURCES.instrumentProfiles,
        ]);
        return result;
      },
      logger,
      'ipc.instrument-update.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.instrumentsDelete, (_event, id: unknown) =>
    asResult(
      () => {
        const parsed = parseIpcInput<string>(instrumentIdSchema, id);
        const previous = dependencies.listCatalogInstrumentsUseCase
          .execute()
          .find((item) => item.id === parsed);
        if (previous === undefined) throw new Error('Instrument not found.');
        const previousDefaults = dependencies.accountStore.listDefaultsForInstrument(parsed);
        let wasArchived = false;
        const result = dependencies.history.execute({
          execute: () => {
            const deleted = dependencies.deleteCatalogInstrumentUseCase.execute(parsed);
            wasArchived = dependencies.listCatalogInstrumentsUseCase
              .execute()
              .some((item) => item.id === parsed);
            return deleted;
          },
          label: 'instrument.delete',
          undo: () =>
            wasArchived
              ? dependencies.restoreCatalogInstrumentUseCase.execute(parsed)
              : (() => {
                  dependencies.createCatalogInstrumentUseCase.execute(
                    {
                      symbol: previous.symbol,
                      category: previous.category,
                      calculationProfile:
                        previous.calculationProfile === null
                          ? null
                          : {
                              tickSize: previous.calculationProfile.tickSize,
                              tickValueUsdPerLot: previous.calculationProfile.tickValueUsdPerLot,
                            },
                    },
                    previous.id,
                  );
                  const byAccount = new Map<string, typeof previousDefaults>();
                  previousDefaults.forEach((item) => {
                    const items = byAccount.get(item.accountId) ?? [];
                    byAccount.set(item.accountId, [...items, item]);
                  });
                  byAccount.forEach((items, accountId) => {
                    const current = dependencies.accountStore
                      .listAccountDefaults(accountId)
                      .filter((item) => item.instrumentId !== parsed);
                    dependencies.accountStore.saveDefaults(accountId, [...current, ...items]);
                  });
                })(),
        });
        capture([
          DATA_RESOURCES.history,
          DATA_RESOURCES.instruments,
          DATA_RESOURCES.instrumentProfiles,
        ]);
        return result;
      },
      logger,
      'ipc.instrument-delete.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.instrumentsRestore, (_event, id: unknown) =>
    asResult(
      () => {
        const result = dependencies.history.execute({
          execute: () =>
            dependencies.restoreCatalogInstrumentUseCase.execute(
              parseIpcInput<string>(instrumentIdSchema, id),
            ),
          label: 'instrument.restore',
          undo: () =>
            dependencies.instrumentStore.archiveInstrument(
              parseIpcInput<string>(instrumentIdSchema, id),
            ),
        });
        capture([DATA_RESOURCES.history, DATA_RESOURCES.instruments]);
        return result;
      },
      logger,
      'ipc.instrument-restore.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.accountsList, () =>
    asResult(() => dependencies.listAccountsUseCase.execute(), logger, 'ipc.accounts-list.failed'),
  );
  ipcMain.handle(IPC_CHANNELS.accountsDefaults, (_event, id: unknown) =>
    asResult(
      () =>
        dependencies.accountStore.listAccountDefaults(parseIpcInput<string>(accountIdSchema, id)),
      logger,
      'ipc.accounts-defaults.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.accountsCreate, (_event, input) =>
    asResult(
      () => {
        const parsed = parseIpcInput<CreateAccountDto>(createAccountSchema, input);
        let created: ReturnType<typeof dependencies.createAccountUseCase.execute> | null = null;
        const result = dependencies.history.execute({
          execute: () => {
            created = dependencies.createAccountUseCase.execute(parsed);
            return (
              dependencies.listAccountsUseCase.execute().find((item) => item.id === created?.id) ??
              created
            );
          },
          label: 'account.create',
          undo: () => {
            if (created !== null) dependencies.deleteAccountUseCase.execute(created.id);
          },
        });
        capture([
          DATA_RESOURCES.history,
          DATA_RESOURCES.accounts,
          DATA_RESOURCES.accountInstrumentDefaults,
        ]);
        return result;
      },
      logger,
      'ipc.account-create.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.accountsUpdate, (_event, input) =>
    asResult(
      () => {
        const parsed = parseIpcInput<UpdateAccountDto>(updateAccountSchema, input);
        const previous = dependencies.listAccountsUseCase
          .execute()
          .find((item) => item.id === parsed.id);
        if (previous === undefined) throw new Error('Account not found.');
        const previousDefaults = dependencies.accountStore.listAccountDefaults(parsed.id);
        const result = dependencies.history.execute({
          execute: () => {
            dependencies.updateAccountUseCase.execute(parsed);
            return dependencies.listAccountsUseCase.execute().find((item) => item.id === parsed.id);
          },
          label: 'account.update',
          undo: () => dependencies.accountStore.restoreAccount(previous, previousDefaults),
        });
        capture([
          DATA_RESOURCES.history,
          DATA_RESOURCES.accounts,
          DATA_RESOURCES.accountInstrumentDefaults,
        ]);
        return result;
      },
      logger,
      'ipc.account-update.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.accountsDelete, (_event, id: unknown) =>
    asResult(
      () => {
        const parsed = parseIpcInput<string>(accountIdSchema, id);
        const previous = dependencies.listAccountsUseCase
          .execute()
          .find((item) => item.id === parsed);
        if (previous === undefined) throw new Error('Account not found.');
        const defaults = dependencies.accountStore.listAccountDefaults(parsed);
        let wasArchived = false;
        const result = dependencies.history.execute({
          execute: () => {
            dependencies.deleteAccountUseCase.execute(parsed);
            wasArchived = dependencies.listAccountsUseCase
              .execute()
              .some((item) => item.id === parsed);
            return previous;
          },
          label: 'account.delete',
          undo: () =>
            wasArchived
              ? dependencies.restoreAccountUseCase.execute(parsed)
              : dependencies.accountStore.restoreAccount(previous, defaults),
        });
        capture([
          DATA_RESOURCES.history,
          DATA_RESOURCES.accounts,
          DATA_RESOURCES.accountInstrumentDefaults,
        ]);
        return result;
      },
      logger,
      'ipc.account-delete.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.accountsRestore, (_event, id: unknown) =>
    asResult(
      () => {
        const parsed = parseIpcInput<string>(accountIdSchema, id);
        const result = dependencies.history.execute({
          execute: () => dependencies.restoreAccountUseCase.execute(parsed),
          label: 'account.restore',
          undo: () => dependencies.accountStore.archiveAccount(parsed),
        });
        capture([DATA_RESOURCES.history, DATA_RESOURCES.accounts]);
        return result;
      },
      logger,
      'ipc.account-restore.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.cashMovementsList, () =>
    asResult(
      () => dependencies.listCashMovementsUseCase.execute(),
      logger,
      'ipc.cash-movements-list.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.cashMovementsCreate, (_event, input: CreateCashMovementDto) =>
    asResult(
      () => {
        const parsed = parseIpcInput<CreateCashMovementDto>(cashMovementSchema, input);
        let created: ReturnType<typeof dependencies.createCashMovementUseCase.execute> | null =
          null;
        const result = dependencies.history.execute({
          execute: () => {
            created = dependencies.createCashMovementUseCase.execute(parsed, created?.id);
            return created;
          },
          label: 'cash-movement.create',
          undo: () => {
            if (created !== null) dependencies.deleteCashMovementUseCase.execute(created.id);
          },
        });
        capture([DATA_RESOURCES.history, DATA_RESOURCES.accounts, DATA_RESOURCES.cashMovements]);
        return result;
      },
      logger,
      'ipc.cash-movement-create.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.cashMovementsUpdate, (_event, input: UpdateCashMovementDto) =>
    asResult(
      () => {
        const parsed = parseIpcInput<UpdateCashMovementDto>(updateCashMovementSchema, input);
        const previous = dependencies.listCashMovementsUseCase
          .execute()
          .find((movement) => movement.id === parsed.id);
        if (previous === undefined) throw new Error('Cash movement not found.');
        const result = dependencies.history.execute({
          execute: () => dependencies.updateCashMovementUseCase.execute(parsed),
          label: 'cash-movement.update',
          undo: () => dependencies.updateCashMovementUseCase.execute(previous),
        });
        capture([DATA_RESOURCES.history, DATA_RESOURCES.accounts, DATA_RESOURCES.cashMovements]);
        return result;
      },
      logger,
      'ipc.cash-movement-update.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.cashMovementsDelete, (_event, id: unknown) =>
    asResult(
      () => {
        const parsed = parseIpcInput<string>(cashMovementIdSchema, id);
        const previous = dependencies.listCashMovementsUseCase
          .execute()
          .find((movement) => movement.id === parsed);
        if (previous === undefined) throw new Error('Cash movement not found.');
        const result = dependencies.history.execute({
          execute: () => dependencies.deleteCashMovementUseCase.execute(parsed),
          label: 'cash-movement.delete',
          undo: () =>
            dependencies.createCashMovementUseCase.execute(
              {
                accountId: previous.accountId,
                amountUsd: previous.amountUsd,
                occurredAt: previous.occurredAt,
                kind: previous.kind,
              },
              previous.id,
            ),
        });
        capture([DATA_RESOURCES.history, DATA_RESOURCES.accounts, DATA_RESOURCES.cashMovements]);
        return result;
      },
      logger,
      'ipc.cash-movement-delete.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.instrumentsCreate, (_event, input) =>
    asResult(
      () => {
        const parsedInput = parseIpcInput(createInstrumentSchema, input);
        let created: ReturnType<typeof dependencies.createCatalogInstrumentUseCase.execute> | null =
          null;
        const result = dependencies.history.execute({
          execute: () => {
            created = dependencies.createCatalogInstrumentUseCase.execute(parsedInput, created?.id);
            return created;
          },
          label: 'instrument.create',
          undo: () => {
            if (created !== null) dependencies.deleteCatalogInstrumentUseCase.execute(created.id);
          },
        });
        capture([DATA_RESOURCES.history, DATA_RESOURCES.instruments]);
        return result;
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
        const changed = dependencies.history.undo();
        if (changed) capture([DATA_RESOURCES.history]);
        return dependencies.history.getState();
      },
      logger,
      'ipc.history-undo.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.historyRedo, () =>
    asResult(
      () => {
        const changed = dependencies.history.redo();
        if (changed) capture([DATA_RESOURCES.history]);
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
      () => {
        const result = dependencies.recentVaultPreferences.updateSettings(
          parseIpcInput(applicationSettingsSchema, settings),
        );
        captureApplicationChange([DATA_RESOURCES.applicationSettings]);
        return result;
      },
      logger,
      'ipc.settings-update.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradePreferencesGet, () =>
    asResult(
      () => dependencies.getTradePreferencesUseCase.execute(),
      logger,
      'ipc.trade-preferences-get.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.tradePreferencesUpdate, (_event, input) =>
    asResult(
      () => {
        const request = parseIpcInput(updateTradePreferencesSchema, input);
        const previousPreferences = dependencies.getTradePreferencesUseCase.execute();
        const previousTrades = dependencies.listTradesUseCase.execute();
        const result = dependencies.history.execute({
          execute: () =>
            dependencies.saveTradePreferencesUseCase.execute(
              request.preferences,
              request.rebindHistorical,
            ),
          label: 'trade-preferences.update',
          undo: () =>
            dependencies.restoreTradePreferencesUseCase.execute(
              previousPreferences,
              previousTrades,
            ),
        });
        capture([DATA_RESOURCES.history, DATA_RESOURCES.tradePreferences, DATA_RESOURCES.trades]);
        return result;
      },
      logger,
      'ipc.trade-preferences-update.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.instrumentProfilesGet, (_event, instrumentId: unknown) =>
    asResult(
      () =>
        dependencies.getInstrumentProfileUseCase.execute(
          parseIpcInput(instrumentIdSchema, instrumentId),
        ),
      logger,
      'ipc.instrument-profile-get.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.instrumentProfilesUpdate, (_event, input) =>
    asResult(
      () => {
        const result = dependencies.saveInstrumentProfileUseCase.execute(
          parseIpcInput(instrumentProfileSchema, input),
        );
        capture([DATA_RESOURCES.instrumentProfiles]);
        return result;
      },
      logger,
      'ipc.instrument-profile-update.failed',
    ),
  );
  ipcMain.handle(IPC_CHANNELS.analyticsSummary, (_event, input) =>
    asAsyncResult(
      async () => {
        const query = parseIpcInput(summaryPreferencesSchema, input);
        const vaultGeneration = dependencies.committedChangeCoordinator.getVaultGeneration();
        try {
          const result = await dependencies.analyticsWorkerClient.run(query, vaultGeneration);
          if (
            result.vaultGeneration !== vaultGeneration ||
            !dependencies.committedChangeCoordinator.isCurrent(result.revisions)
          )
            return null;
          return result.summary;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return null;
          throw error;
        }
      },
      logger,
      'ipc.analytics-summary.failed',
    ),
  );
};
