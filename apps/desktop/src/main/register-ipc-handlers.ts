import { BrowserWindow } from 'electron';

import type { CommittedDataChangeDto, DataResource } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';

import type { DesktopDependencies } from './desktop-container';
import type { IpcRegistrationContext } from './ipc-registration-context';
import { registerAccountIpcHandlers } from './register-account-ipc-handlers';
import { registerAnalyticsIpcHandlers } from './register-analytics-ipc-handlers';
import { registerDiagnosticsIpcHandlers } from './register-diagnostics-ipc-handlers';
import { registerHistoryIpcHandlers } from './register-history-ipc-handlers';
import { registerInstrumentIpcHandlers } from './register-instrument-ipc-handlers';
import { registerSettingsIpcHandlers } from './register-settings-ipc-handlers';
import { registerTagIpcHandlers } from './register-tag-ipc-handlers';
import { registerTradeIpcHandlers } from './register-trade-ipc-handlers';
import { registerVaultIpcHandlers } from './register-vault-ipc-handlers';
import { registerVaultBackupIpcHandlers } from './register-vault-backup-ipc-handlers';

/**
 * Composition only: builds the shared IPC context and delegates every
 * capability to its own registrar with narrow dependencies.
 */
export const registerIpcHandlers = (
  dependencies: DesktopDependencies,
  appName: string,
  appVersion: string,
): void => {
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
  const context: IpcRegistrationContext = {
    capture,
    captureApplicationChange,
    logger: dependencies.logger,
    publish,
  };

  registerDiagnosticsIpcHandlers(
    {
      appName,
      appVersion,
      applicationPaths: dependencies.applicationPaths,
      journalStorage: dependencies.journalStorage,
    },
    context,
  );

  registerVaultIpcHandlers(
    {
      inspectVaultUseCase: dependencies.inspectVaultUseCase,
      journalStorage: dependencies.journalStorage,
      vaultFolderOpener: dependencies.vaultFolderOpener,
      vaultLocationPicker: dependencies.vaultLocationPicker,
      vaultSessionCoordinator: dependencies.vaultSessionCoordinator,
    },
    context,
  );

  registerVaultBackupIpcHandlers(
    {
      createVaultBackupUseCase: dependencies.createVaultBackupUseCase,
      listVaultBackupsUseCase: dependencies.listVaultBackupsUseCase,
      verifyVaultBackupUseCase: dependencies.verifyVaultBackupUseCase,
      restoreVaultBackupUseCase: dependencies.restoreVaultBackupUseCase,
      journalStorage: dependencies.journalStorage,
      vaultLocationPicker: dependencies.vaultLocationPicker,
    },
    context,
  );

  registerTagIpcHandlers(
    {
      commands: dependencies.tagCommands,
      getTagTradeCountsUseCase: dependencies.getTagTradeCountsUseCase,
      listTagsUseCase: dependencies.listTagsUseCase,
    },
    context,
  );

  registerTradeIpcHandlers(
    {
      commands: dependencies.tradeCommands,
      getTradeByIdUseCase: dependencies.getTradeByIdUseCase,
      getTradePreferencesUseCase: dependencies.getTradePreferencesUseCase,
      journalTableReader: dependencies.journalTableReader,
      preferencesCommands: dependencies.tradePreferencesCommands,
    },
    context,
  );

  registerAccountIpcHandlers(
    {
      accountCommands: dependencies.accountCommands,
      cashMovementCommands: dependencies.cashMovementCommands,
      listAccountDefaultsUseCase: dependencies.listAccountDefaultsUseCase,
      listAccountsUseCase: dependencies.listAccountsUseCase,
      listCashMovementsUseCase: dependencies.listCashMovementsUseCase,
    },
    context,
  );

  registerInstrumentIpcHandlers(
    {
      commands: dependencies.instrumentCommands,
      getInstrumentProfileUseCase: dependencies.getInstrumentProfileUseCase,
      listInstrumentsUseCase: dependencies.listCatalogInstrumentsUseCase,
      saveInstrumentProfileUseCase: dependencies.saveInstrumentProfileUseCase,
    },
    context,
  );

  registerHistoryIpcHandlers({ history: dependencies.history }, context);
  registerSettingsIpcHandlers(
    { recentVaultPreferences: dependencies.recentVaultPreferences },
    context,
  );

  registerAnalyticsIpcHandlers(
    {
      analyticsWorkerClient: dependencies.analyticsWorkerClient,
      committedChangeCoordinator: dependencies.committedChangeCoordinator,
    },
    context,
  );
};
