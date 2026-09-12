import {
  asClass,
  asFunction,
  asValue,
  createContainer,
  InjectionMode,
  type AwilixContainer,
} from 'awilix';
import type { App } from 'electron';

import {
  CheckVaultIntegrityUseCase,
  CreateTradeUseCase,
  CreateVaultUseCase,
  ListTradesUseCase,
  OpenVaultUseCase,
} from '@tjournal/journal';
import {
  createRuntimeConfiguration,
  type ApplicationPaths,
} from '@tjournal/platform-configuration';
import { SqliteJournalStorage } from '@tjournal/platform-database';
import { createPinoFileLogger, type Logger } from '@tjournal/platform-observability';

import { createElectronApplicationPaths } from './electron-application-paths';
import { ElectronVaultLocationPicker } from './electron-vault-location-picker';
import { RecentVaultPreferences } from './recent-vault-preferences';

export interface DesktopDependencies {
  readonly applicationPaths: ApplicationPaths;
  readonly checkVaultIntegrityUseCase: CheckVaultIntegrityUseCase;
  readonly createTradeUseCase: CreateTradeUseCase;
  readonly createVaultUseCase: CreateVaultUseCase;
  readonly journalStorage: SqliteJournalStorage;
  readonly listTradesUseCase: ListTradesUseCase;
  readonly logger: Logger;
  readonly openVaultUseCase: OpenVaultUseCase;
  readonly recentVaultPreferences: RecentVaultPreferences;
  readonly vaultLocationPicker: ElectronVaultLocationPicker;
}

export const createDesktopContainer = (electronApp: App): AwilixContainer<DesktopDependencies> => {
  const applicationPaths = createElectronApplicationPaths(electronApp);
  const runtimeConfiguration = createRuntimeConfiguration();

  return createContainer<DesktopDependencies>({ injectionMode: InjectionMode.CLASSIC }).register({
    applicationPaths: asValue(applicationPaths),
    checkVaultIntegrityUseCase: asClass(CheckVaultIntegrityUseCase).singleton(),
    createTradeUseCase: asClass(CreateTradeUseCase).singleton(),
    createVaultUseCase: asClass(CreateVaultUseCase).singleton(),
    journalStorage: asClass(SqliteJournalStorage).singleton(),
    listTradesUseCase: asClass(ListTradesUseCase).singleton(),
    logger: asFunction(() =>
      createPinoFileLogger({
        logsDirectory: applicationPaths.logsDirectory,
        retentionDays: runtimeConfiguration.logRetentionDays,
      }),
    ).singleton(),
    openVaultUseCase: asClass(OpenVaultUseCase).singleton(),
    recentVaultPreferences: asFunction(
      () => new RecentVaultPreferences(applicationPaths.preferencesFilePath),
    ).singleton(),
    vaultLocationPicker: asClass(ElectronVaultLocationPicker).singleton(),
  });
};
