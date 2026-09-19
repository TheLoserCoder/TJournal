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
  CreateVaultUseCase,
  DeleteInstrumentUseCase,
  ListInstrumentsUseCase,
  OpenVaultUseCase,
} from '@tjournal/journal';
import {
  CreateAccountUseCase,
  CreateCashMovementUseCase,
  DeleteAccountUseCase,
  DeleteCashMovementUseCase,
  ListAccountsUseCase,
  ListCashMovementsUseCase,
  RestoreAccountUseCase,
  UpdateAccountUseCase,
  UpdateCashMovementUseCase,
} from '@tjournal/account';
import {
  CreateInstrumentUseCase as CreateCatalogInstrumentUseCase,
  DeleteInstrumentUseCase as DeleteCatalogInstrumentUseCase,
  ListInstrumentsUseCase as ListCatalogInstrumentsUseCase,
  RestoreInstrumentUseCase as RestoreCatalogInstrumentUseCase,
  UpdateInstrumentUseCase as UpdateCatalogInstrumentUseCase,
} from '@tjournal/instrument';
import {
  CreateTradeUseCase,
  DeleteTradeUseCase,
  DeleteTradesUseCase,
  GetTradePreferencesUseCase,
  GetInstrumentProfileUseCase,
  ListTradesUseCase,
  RestoreTradesUseCase,
  RestoreTradeUseCase,
  RestoreTradePreferencesUseCase,
  SaveInstrumentProfileUseCase,
  SaveTradePreferencesUseCase,
  UpdateTradeUseCase,
} from '@tjournal/trade';
import {
  createRuntimeConfiguration,
  type ApplicationPaths,
} from '@tjournal/platform-configuration';
import {
  SqliteJournalStorage,
  SqliteAccountStore,
  SqliteInstrumentStore,
  SqliteTradeStore,
  SqliteVaultDatabase,
} from '@tjournal/platform-database';
import { createPinoFileLogger, type Logger } from '@tjournal/platform-observability';

import { createElectronApplicationPaths } from './electron-application-paths';
import { ElectronVaultLocationPicker } from './electron-vault-location-picker';
import { UndoRedoHistory } from './history/undo-redo-history';
import { RecentVaultPreferences } from './recent-vault-preferences';
import { CommittedChangeCoordinator } from './committed-change-coordinator';
import { AnalyticsWorkerClient } from './analytics-worker-client';

export interface DesktopDependencies {
  readonly analyticsWorkerClient: AnalyticsWorkerClient;
  readonly applicationPaths: ApplicationPaths;
  readonly checkVaultIntegrityUseCase: CheckVaultIntegrityUseCase;
  readonly committedChangeCoordinator: CommittedChangeCoordinator;
  readonly createInstrumentUseCase: CreateInstrumentUseCase;
  readonly createTradeUseCase: CreateTradeUseCase;
  readonly createAccountUseCase: CreateAccountUseCase;
  readonly createCashMovementUseCase: CreateCashMovementUseCase;
  readonly accountStore: SqliteAccountStore;
  readonly deleteAccountUseCase: DeleteAccountUseCase;
  readonly deleteCashMovementUseCase: DeleteCashMovementUseCase;
  readonly listAccountsUseCase: ListAccountsUseCase;
  readonly listCashMovementsUseCase: ListCashMovementsUseCase;
  readonly updateAccountUseCase: UpdateAccountUseCase;
  readonly updateCashMovementUseCase: UpdateCashMovementUseCase;
  readonly restoreAccountUseCase: RestoreAccountUseCase;
  readonly createVaultUseCase: CreateVaultUseCase;
  readonly deleteTradeUseCase: DeleteTradeUseCase;
  readonly deleteTradesUseCase: DeleteTradesUseCase;
  readonly deleteInstrumentUseCase: DeleteInstrumentUseCase;
  readonly instrumentStore: SqliteInstrumentStore;
  readonly createCatalogInstrumentUseCase: CreateCatalogInstrumentUseCase;
  readonly deleteCatalogInstrumentUseCase: DeleteCatalogInstrumentUseCase;
  readonly listCatalogInstrumentsUseCase: ListCatalogInstrumentsUseCase;
  readonly restoreCatalogInstrumentUseCase: RestoreCatalogInstrumentUseCase;
  readonly updateCatalogInstrumentUseCase: UpdateCatalogInstrumentUseCase;
  readonly history: UndoRedoHistory;
  readonly getTradePreferencesUseCase: GetTradePreferencesUseCase;
  readonly getInstrumentProfileUseCase: GetInstrumentProfileUseCase;
  readonly journalStorage: SqliteJournalStorage;
  readonly listInstrumentsUseCase: ListInstrumentsUseCase;
  readonly listTradesUseCase: ListTradesUseCase;
  readonly logger: Logger;
  readonly openVaultUseCase: OpenVaultUseCase;
  readonly recentVaultPreferences: RecentVaultPreferences;
  readonly restoreTradesUseCase: RestoreTradesUseCase;
  readonly restoreTradeUseCase: RestoreTradeUseCase;
  readonly restoreTradePreferencesUseCase: RestoreTradePreferencesUseCase;
  readonly saveInstrumentProfileUseCase: SaveInstrumentProfileUseCase;
  readonly saveTradePreferencesUseCase: SaveTradePreferencesUseCase;
  readonly tradeStore: SqliteTradeStore;
  readonly vaultLocationPicker: ElectronVaultLocationPicker;
  readonly updateTradeUseCase: UpdateTradeUseCase;
  readonly vaultDatabase: SqliteVaultDatabase;
}

export const createDesktopContainer = (electronApp: App): AwilixContainer<DesktopDependencies> => {
  const applicationPaths = createElectronApplicationPaths(electronApp);
  const runtimeConfiguration = createRuntimeConfiguration();

  return createContainer<DesktopDependencies>({ injectionMode: InjectionMode.CLASSIC }).register({
    analyticsWorkerClient: asClass(AnalyticsWorkerClient).singleton(),
    applicationPaths: asValue(applicationPaths),
    checkVaultIntegrityUseCase: asClass(CheckVaultIntegrityUseCase).singleton(),
    committedChangeCoordinator: asClass(CommittedChangeCoordinator).singleton(),
    createInstrumentUseCase: asClass(CreateInstrumentUseCase).singleton(),
    createCatalogInstrumentUseCase: asClass(CreateCatalogInstrumentUseCase).singleton(),
    createAccountUseCase: asClass(CreateAccountUseCase).singleton(),
    createCashMovementUseCase: asClass(CreateCashMovementUseCase).singleton(),
    createTradeUseCase: asClass(CreateTradeUseCase).singleton(),
    createVaultUseCase: asClass(CreateVaultUseCase).singleton(),
    deleteTradeUseCase: asClass(DeleteTradeUseCase).singleton(),
    deleteTradesUseCase: asClass(DeleteTradesUseCase).singleton(),
    deleteInstrumentUseCase: asClass(DeleteInstrumentUseCase).singleton(),
    deleteCatalogInstrumentUseCase: asClass(DeleteCatalogInstrumentUseCase).singleton(),
    deleteAccountUseCase: asClass(DeleteAccountUseCase).singleton(),
    deleteCashMovementUseCase: asClass(DeleteCashMovementUseCase).singleton(),
    getTradePreferencesUseCase: asClass(GetTradePreferencesUseCase).singleton(),
    getInstrumentProfileUseCase: asClass(GetInstrumentProfileUseCase).singleton(),
    history: asClass(UndoRedoHistory).singleton(),
    journalStorage: asClass(SqliteJournalStorage).singleton(),
    listInstrumentsUseCase: asClass(ListInstrumentsUseCase).singleton(),
    listCatalogInstrumentsUseCase: asClass(ListCatalogInstrumentsUseCase).singleton(),
    listAccountsUseCase: asClass(ListAccountsUseCase).singleton(),
    listCashMovementsUseCase: asClass(ListCashMovementsUseCase).singleton(),
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
    restoreTradesUseCase: asClass(RestoreTradesUseCase).singleton(),
    restoreTradeUseCase: asClass(RestoreTradeUseCase).singleton(),
    restoreTradePreferencesUseCase: asClass(RestoreTradePreferencesUseCase).singleton(),
    saveInstrumentProfileUseCase: asClass(SaveInstrumentProfileUseCase).singleton(),
    saveTradePreferencesUseCase: asClass(SaveTradePreferencesUseCase).singleton(),
    instrumentStore: asClass(SqliteInstrumentStore).singleton(),
    accountStore: asClass(SqliteAccountStore).singleton(),
    tradeStore: asClass(SqliteTradeStore).singleton(),
    vaultLocationPicker: asClass(ElectronVaultLocationPicker).singleton(),
    updateTradeUseCase: asClass(UpdateTradeUseCase).singleton(),
    updateAccountUseCase: asClass(UpdateAccountUseCase).singleton(),
    updateCashMovementUseCase: asClass(UpdateCashMovementUseCase).singleton(),
    restoreAccountUseCase: asClass(RestoreAccountUseCase).singleton(),
    restoreCatalogInstrumentUseCase: asClass(RestoreCatalogInstrumentUseCase).singleton(),
    updateCatalogInstrumentUseCase: asClass(UpdateCatalogInstrumentUseCase).singleton(),
    vaultDatabase: asClass(SqliteVaultDatabase).singleton(),
  });
};
