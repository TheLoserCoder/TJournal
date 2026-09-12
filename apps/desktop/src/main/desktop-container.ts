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
  CreateInstrumentUseCase,
  CreateTradeUseCase,
  CreateVaultUseCase,
  DeleteTradeUseCase,
  DeleteInstrumentUseCase,
  ListInstrumentsUseCase,
  ListTradesUseCase,
  OpenVaultUseCase,
  UpdateTradeUseCase,
} from '@tjournal/journal';
import {
  createRuntimeConfiguration,
  type ApplicationPaths,
} from '@tjournal/platform-configuration';
import { SqliteJournalStorage } from '@tjournal/platform-database';
import { createPinoFileLogger, type Logger } from '@tjournal/platform-observability';

import { createElectronApplicationPaths } from './electron-application-paths';
import { ElectronVaultLocationPicker } from './electron-vault-location-picker';
import { UndoRedoHistory } from './history/undo-redo-history';
import { RecentVaultPreferences } from './recent-vault-preferences';

export interface DesktopDependencies {
  readonly applicationPaths: ApplicationPaths;
  readonly checkVaultIntegrityUseCase: CheckVaultIntegrityUseCase;
  readonly createInstrumentUseCase: CreateInstrumentUseCase;
  readonly createTradeUseCase: CreateTradeUseCase;
  readonly createVaultUseCase: CreateVaultUseCase;
  readonly deleteTradeUseCase: DeleteTradeUseCase;
  readonly deleteInstrumentUseCase: DeleteInstrumentUseCase;
  readonly history: UndoRedoHistory;
  readonly journalStorage: SqliteJournalStorage;
  readonly listInstrumentsUseCase: ListInstrumentsUseCase;
  readonly listTradesUseCase: ListTradesUseCase;
  readonly logger: Logger;
  readonly openVaultUseCase: OpenVaultUseCase;
  readonly recentVaultPreferences: RecentVaultPreferences;
  readonly vaultLocationPicker: ElectronVaultLocationPicker;
  readonly updateTradeUseCase: UpdateTradeUseCase;
}

export const createDesktopContainer = (electronApp: App): AwilixContainer<DesktopDependencies> => {
  const applicationPaths = createElectronApplicationPaths(electronApp);
  const runtimeConfiguration = createRuntimeConfiguration();

  return createContainer<DesktopDependencies>({ injectionMode: InjectionMode.CLASSIC }).register({
    applicationPaths: asValue(applicationPaths),
    checkVaultIntegrityUseCase: asClass(CheckVaultIntegrityUseCase).singleton(),
    createInstrumentUseCase: asClass(CreateInstrumentUseCase).singleton(),
    createTradeUseCase: asClass(CreateTradeUseCase).singleton(),
    createVaultUseCase: asClass(CreateVaultUseCase).singleton(),
    deleteTradeUseCase: asClass(DeleteTradeUseCase).singleton(),
    deleteInstrumentUseCase: asClass(DeleteInstrumentUseCase).singleton(),
    history: asClass(UndoRedoHistory).singleton(),
    journalStorage: asClass(SqliteJournalStorage).singleton(),
    listInstrumentsUseCase: asClass(ListInstrumentsUseCase).singleton(),
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
    updateTradeUseCase: asClass(UpdateTradeUseCase).singleton(),
  });
};
