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
  CreateVaultBackupUseCase,
  CreateVaultUseCase,
  InspectVaultUseCase,
  ListVaultBackupsUseCase,
  OpenVaultUseCase,
  RestoreVaultBackupUseCase,
  VerifyVaultBackupUseCase,
  type VaultLocationPicker,
} from '@tjournal/journal';
import {
  ArchiveAccountUseCase,
  CreateAccountUseCase,
  CreateCashMovementUseCase,
  DeleteAccountUseCase,
  DeleteCashMovementUseCase,
  GetAccountByIdUseCase,
  GetCashMovementByIdUseCase,
  ListAccountDefaultsUseCase,
  ListAccountsUseCase,
  ListCashMovementsUseCase,
  ListInstrumentDefaultsUseCase,
  RestoreAccountSnapshotUseCase,
  RestoreAccountUseCase,
  RestoreInstrumentDefaultsUseCase,
  UpdateAccountUseCase,
  UpdateCashMovementUseCase,
} from '@tjournal/account';
import {
  ArchiveInstrumentUseCase,
  CreateInstrumentUseCase as CreateCatalogInstrumentUseCase,
  DeleteInstrumentUseCase as DeleteCatalogInstrumentUseCase,
  GetInstrumentByIdUseCase,
  GetInstrumentProfileUseCase,
  ListInstrumentsUseCase as ListCatalogInstrumentsUseCase,
  RestoreInstrumentUseCase as RestoreCatalogInstrumentUseCase,
  SaveInstrumentProfileUseCase,
  UpdateInstrumentUseCase as UpdateCatalogInstrumentUseCase,
} from '@tjournal/instrument';
import {
  CreateTagUseCase,
  DeleteTagsUseCase,
  GetTagByIdUseCase,
  GetTagTradeCountsUseCase,
  ListTagsUseCase,
  RestoreTagsUseCase,
  UpdateTagUseCase,
} from '@tjournal/tag';
import {
  CreateTradeUseCase,
  DeleteTradeUseCase,
  DeleteTradesUseCase,
  GetTradePreferencesUseCase,
  GetTradeByIdUseCase,
  RestoreTradesUseCase,
  RestoreTradeUseCase,
  RestoreTradePreferencesUseCase,
  SaveTradePreferencesUseCase,
  UpdateTradeUseCase,
} from '@tjournal/trade';
import {
  createRuntimeConfiguration,
  type ApplicationPaths,
} from '@tjournal/platform-configuration';
import {
  SqliteJournalStorage,
  SqliteVaultBackupStore,
  SqliteAccountStore,
  SqliteInstrumentStore,
  SqliteJournalTableReader,
  SqliteTagStore,
  SqliteTradeStore,
  SqliteTradeUnitOfWork,
  SqliteVaultDatabase,
} from '@tjournal/platform-database';
import { createPinoFileLogger, type Logger } from '@tjournal/platform-observability';

import { createElectronApplicationPaths } from './electron-application-paths';
import { ElectronVaultFolderOpener } from './electron-vault-folder-opener';
import { ElectronVaultLocationPicker } from './electron-vault-location-picker';
import { E2EVaultLocationPicker } from './e2e-vault-location-picker';
import { getE2EEnvironmentValue } from './e2e-environment';
import { AccountCommands } from './application/accounts/account-commands';
import { CashMovementCommands } from './application/cash-movements/cash-movement-commands';
import { InstrumentCommands } from './application/instruments/instrument-commands';
import { TagCommands } from './application/tags/tag-commands';
import { TradeCommands } from './application/trades/trade-commands';
import { TradePreferencesCommands } from './application/trade-preferences/trade-preferences-commands';
import { UndoRedoHistory } from './history/undo-redo-history';
import { SqliteCommandTransaction } from './history/sqlite-command-transaction';
import { RecentVaultPreferences } from './recent-vault-preferences';
import { CommittedChangeCoordinator } from './committed-change-coordinator';
import { AnalyticsWorkerClient } from './analytics-worker-client';
import { VaultSessionCoordinator } from './vault-session-coordinator';

export interface DesktopDependencies {
  readonly accountCommands: AccountCommands;
  readonly analyticsWorkerClient: AnalyticsWorkerClient;
  readonly applicationPaths: ApplicationPaths;
  readonly archiveAccountUseCase: ArchiveAccountUseCase;
  readonly archiveInstrumentUseCase: ArchiveInstrumentUseCase;
  readonly cashMovementCommands: CashMovementCommands;
  readonly checkVaultIntegrityUseCase: CheckVaultIntegrityUseCase;
  readonly commandTransaction: SqliteCommandTransaction;
  readonly committedChangeCoordinator: CommittedChangeCoordinator;
  readonly createTradeUseCase: CreateTradeUseCase;
  readonly createAccountUseCase: CreateAccountUseCase;
  readonly createCashMovementUseCase: CreateCashMovementUseCase;
  readonly accountStore: SqliteAccountStore;
  readonly deleteAccountUseCase: DeleteAccountUseCase;
  readonly deleteCashMovementUseCase: DeleteCashMovementUseCase;
  readonly getCashMovementByIdUseCase: GetCashMovementByIdUseCase;
  readonly instrumentCommands: InstrumentCommands;
  readonly listAccountDefaultsUseCase: ListAccountDefaultsUseCase;
  readonly listAccountsUseCase: ListAccountsUseCase;
  readonly listCashMovementsUseCase: ListCashMovementsUseCase;
  readonly listInstrumentDefaultsUseCase: ListInstrumentDefaultsUseCase;
  readonly updateAccountUseCase: UpdateAccountUseCase;
  readonly updateCashMovementUseCase: UpdateCashMovementUseCase;
  readonly restoreAccountSnapshotUseCase: RestoreAccountSnapshotUseCase;
  readonly restoreAccountUseCase: RestoreAccountUseCase;
  readonly restoreInstrumentDefaultsUseCase: RestoreInstrumentDefaultsUseCase;
  readonly createVaultUseCase: CreateVaultUseCase;
  readonly createVaultBackupUseCase: CreateVaultBackupUseCase;
  readonly deleteTradeUseCase: DeleteTradeUseCase;
  readonly deleteTradesUseCase: DeleteTradesUseCase;
  readonly instrumentStore: SqliteInstrumentStore;
  readonly createCatalogInstrumentUseCase: CreateCatalogInstrumentUseCase;
  readonly deleteCatalogInstrumentUseCase: DeleteCatalogInstrumentUseCase;
  readonly listCatalogInstrumentsUseCase: ListCatalogInstrumentsUseCase;
  readonly restoreCatalogInstrumentUseCase: RestoreCatalogInstrumentUseCase;
  readonly updateCatalogInstrumentUseCase: UpdateCatalogInstrumentUseCase;
  readonly history: UndoRedoHistory;
  readonly getTradePreferencesUseCase: GetTradePreferencesUseCase;
  readonly getTradeByIdUseCase: GetTradeByIdUseCase;
  readonly getAccountByIdUseCase: GetAccountByIdUseCase;
  readonly getInstrumentByIdUseCase: GetInstrumentByIdUseCase;
  readonly getTagByIdUseCase: GetTagByIdUseCase;
  readonly getTagTradeCountsUseCase: GetTagTradeCountsUseCase;
  readonly getInstrumentProfileUseCase: GetInstrumentProfileUseCase;
  readonly inspectVaultUseCase: InspectVaultUseCase;
  readonly journalStorage: SqliteJournalStorage;
  readonly vaultBackupStore: SqliteVaultBackupStore;
  readonly listVaultBackupsUseCase: ListVaultBackupsUseCase;
  readonly verifyVaultBackupUseCase: VerifyVaultBackupUseCase;
  readonly restoreVaultBackupUseCase: RestoreVaultBackupUseCase;
  readonly journalTableReader: SqliteJournalTableReader;
  readonly logger: Logger;
  readonly openVaultUseCase: OpenVaultUseCase;
  readonly recentVaultPreferences: RecentVaultPreferences;
  readonly restoreTradesUseCase: RestoreTradesUseCase;
  readonly restoreTradeUseCase: RestoreTradeUseCase;
  readonly restoreTradePreferencesUseCase: RestoreTradePreferencesUseCase;
  readonly saveInstrumentProfileUseCase: SaveInstrumentProfileUseCase;
  readonly saveTradePreferencesUseCase: SaveTradePreferencesUseCase;
  readonly tagCommands: TagCommands;
  readonly tradeCommands: TradeCommands;
  readonly tradePreferencesCommands: TradePreferencesCommands;
  readonly tradeStore: SqliteTradeStore;
  readonly tradeUnitOfWork: SqliteTradeUnitOfWork;
  readonly tagStore: SqliteTagStore;
  readonly createTagUseCase: CreateTagUseCase;
  readonly updateTagUseCase: UpdateTagUseCase;
  readonly listTagsUseCase: ListTagsUseCase;
  readonly deleteTagsUseCase: DeleteTagsUseCase;
  readonly restoreTagsUseCase: RestoreTagsUseCase;
  readonly vaultFolderOpener: ElectronVaultFolderOpener;
  readonly vaultLocationPicker: VaultLocationPicker;
  readonly vaultSessionCoordinator: VaultSessionCoordinator;
  readonly updateTradeUseCase: UpdateTradeUseCase;
  readonly vaultDatabase: SqliteVaultDatabase;
}

const createVaultLocationPicker = (): VaultLocationPicker => {
  const pickerFilePath = getE2EEnvironmentValue('TJOURNAL_E2E_PICKER_FILE');
  return pickerFilePath === null
    ? new ElectronVaultLocationPicker()
    : new E2EVaultLocationPicker(pickerFilePath);
};

export const createDesktopContainer = (electronApp: App): AwilixContainer<DesktopDependencies> => {
  const applicationPaths = createElectronApplicationPaths(electronApp);
  const runtimeConfiguration = createRuntimeConfiguration();

  return createContainer<DesktopDependencies>({ injectionMode: InjectionMode.CLASSIC }).register({
    accountCommands: asClass(AccountCommands).singleton(),
    analyticsWorkerClient: asClass(AnalyticsWorkerClient).singleton(),
    applicationPaths: asValue(applicationPaths),
    archiveAccountUseCase: asClass(ArchiveAccountUseCase).singleton(),
    archiveInstrumentUseCase: asClass(ArchiveInstrumentUseCase).singleton(),
    cashMovementCommands: asClass(CashMovementCommands).singleton(),
    checkVaultIntegrityUseCase: asClass(CheckVaultIntegrityUseCase).singleton(),
    commandTransaction: asClass(SqliteCommandTransaction).singleton(),
    committedChangeCoordinator: asClass(CommittedChangeCoordinator).singleton(),
    createCatalogInstrumentUseCase: asClass(CreateCatalogInstrumentUseCase).singleton(),
    createAccountUseCase: asClass(CreateAccountUseCase).singleton(),
    createCashMovementUseCase: asClass(CreateCashMovementUseCase).singleton(),
    createTradeUseCase: asClass(CreateTradeUseCase).singleton(),
    createVaultUseCase: asClass(CreateVaultUseCase).singleton(),
    createVaultBackupUseCase: asClass(CreateVaultBackupUseCase).singleton(),
    getCashMovementByIdUseCase: asClass(GetCashMovementByIdUseCase).singleton(),
    instrumentCommands: asClass(InstrumentCommands).singleton(),
    listAccountDefaultsUseCase: asClass(ListAccountDefaultsUseCase).singleton(),
    listInstrumentDefaultsUseCase: asClass(ListInstrumentDefaultsUseCase).singleton(),
    restoreAccountSnapshotUseCase: asClass(RestoreAccountSnapshotUseCase).singleton(),
    restoreInstrumentDefaultsUseCase: asClass(RestoreInstrumentDefaultsUseCase).singleton(),
    tagCommands: asClass(TagCommands).singleton(),
    tradeCommands: asClass(TradeCommands).singleton(),
    tradePreferencesCommands: asClass(TradePreferencesCommands).singleton(),
    deleteTradeUseCase: asClass(DeleteTradeUseCase).singleton(),
    deleteTradesUseCase: asClass(DeleteTradesUseCase).singleton(),
    deleteCatalogInstrumentUseCase: asClass(DeleteCatalogInstrumentUseCase).singleton(),
    deleteAccountUseCase: asClass(DeleteAccountUseCase).singleton(),
    deleteCashMovementUseCase: asClass(DeleteCashMovementUseCase).singleton(),
    getTradePreferencesUseCase: asClass(GetTradePreferencesUseCase).singleton(),
    getTradeByIdUseCase: asClass(GetTradeByIdUseCase).singleton(),
    getAccountByIdUseCase: asClass(GetAccountByIdUseCase).singleton(),
    getInstrumentByIdUseCase: asClass(GetInstrumentByIdUseCase).singleton(),
    getTagByIdUseCase: asClass(GetTagByIdUseCase).singleton(),
    getTagTradeCountsUseCase: asClass(GetTagTradeCountsUseCase).singleton(),
    getInstrumentProfileUseCase: asClass(GetInstrumentProfileUseCase).singleton(),
    history: asClass(UndoRedoHistory).singleton(),
    inspectVaultUseCase: asClass(InspectVaultUseCase).singleton(),
    journalStorage: asClass(SqliteJournalStorage).singleton(),
    vaultBackupStore: asFunction(
      (journalStorage: SqliteJournalStorage, logger: Logger) =>
        new SqliteVaultBackupStore(journalStorage, electronApp.getVersion(), logger),
    ).singleton(),
    listVaultBackupsUseCase: asClass(ListVaultBackupsUseCase).singleton(),
    verifyVaultBackupUseCase: asClass(VerifyVaultBackupUseCase).singleton(),
    restoreVaultBackupUseCase: asClass(RestoreVaultBackupUseCase).singleton(),
    journalTableReader: asClass(SqliteJournalTableReader).singleton(),
    listCatalogInstrumentsUseCase: asClass(ListCatalogInstrumentsUseCase).singleton(),
    listAccountsUseCase: asClass(ListAccountsUseCase).singleton(),
    listCashMovementsUseCase: asClass(ListCashMovementsUseCase).singleton(),
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
    tradeUnitOfWork: asClass(SqliteTradeUnitOfWork).singleton(),
    tagStore: asClass(SqliteTagStore).singleton(),
    createTagUseCase: asClass(CreateTagUseCase).singleton(),
    updateTagUseCase: asClass(UpdateTagUseCase).singleton(),
    listTagsUseCase: asClass(ListTagsUseCase).singleton(),
    deleteTagsUseCase: asClass(DeleteTagsUseCase).singleton(),
    restoreTagsUseCase: asClass(RestoreTagsUseCase).singleton(),
    vaultFolderOpener: asClass(ElectronVaultFolderOpener).singleton(),
    vaultLocationPicker: asFunction(createVaultLocationPicker).singleton(),
    vaultSessionCoordinator: asClass(VaultSessionCoordinator).singleton(),
    updateTradeUseCase: asClass(UpdateTradeUseCase).singleton(),
    updateAccountUseCase: asClass(UpdateAccountUseCase).singleton(),
    updateCashMovementUseCase: asClass(UpdateCashMovementUseCase).singleton(),
    restoreAccountUseCase: asClass(RestoreAccountUseCase).singleton(),
    restoreCatalogInstrumentUseCase: asClass(RestoreCatalogInstrumentUseCase).singleton(),
    updateCatalogInstrumentUseCase: asClass(UpdateCatalogInstrumentUseCase).singleton(),
    vaultDatabase: asClass(SqliteVaultDatabase).singleton(),
  });
};
