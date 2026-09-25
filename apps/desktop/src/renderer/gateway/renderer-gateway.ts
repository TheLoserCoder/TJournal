import type {
  ApplicationSettingsDto,
  AnalyticsReportDto,
  AnalyticsReportRequestDto,
  AppDiagnosticsDto,
  AccountDto,
  AccountInstrumentDefaultsDto,
  CashMovementDto,
  CreateCashMovementDto,
  CreateAccountDto,
  CommittedDataChangeDto,
  CreateInstrumentDto,
  CreateTagDto,
  CreateTradeDto,
  HistoryStateDto,
  InstrumentDto,
  JournalPageDto,
  JournalPageRequestDto,
  TagDto,
  UpdateAccountDto,
  UpdateInstrumentDto,
  UpdateTagDto,
  IpcResult,
  TradeDto,
  TradePreferencesDto,
  InstrumentCalculationProfileDto,
  TradeSummaryDto,
  TradeSummaryRequestDto,
  UpdateTradePreferencesDto,
  UpdateCashMovementDto,
  VaultDto,
  VaultBackupDto,
  VaultBackupPageDto,
} from '../../shared/desktop-api';

export interface RendererGateway {
  getDiagnostics(): Promise<IpcResult<AppDiagnosticsDto>>;
  createVault(): Promise<IpcResult<VaultDto | null>>;
  createVaultBackup(): Promise<IpcResult<VaultBackupDto>>;
  listVaultBackups(beforeId?: string | null): Promise<IpcResult<VaultBackupPageDto>>;
  verifyVaultBackup(id: string): Promise<IpcResult<VaultBackupDto>>;
  restoreVaultBackup(id: string): Promise<IpcResult<VaultDto | null>>;
  openVault(): Promise<IpcResult<VaultDto | null>>;
  revealVaultFolder(): Promise<IpcResult<VaultDto>>;
  validateVault(): Promise<IpcResult<VaultDto>>;
  subscribeToChanges(listener: (change: CommittedDataChangeDto) => void): () => void;
  createInstrument(input: CreateInstrumentDto): Promise<IpcResult<InstrumentDto>>;
  updateInstrument(input: UpdateInstrumentDto): Promise<IpcResult<InstrumentDto>>;
  deleteInstrument(id: string): Promise<IpcResult<InstrumentDto>>;
  restoreInstrument(id: string): Promise<IpcResult<InstrumentDto>>;
  createAccount(input: CreateAccountDto): Promise<IpcResult<AccountDto>>;
  listAccounts(): Promise<IpcResult<readonly AccountDto[]>>;
  updateAccount(input: UpdateAccountDto): Promise<IpcResult<AccountDto>>;
  deleteAccount(id: string): Promise<IpcResult<AccountDto>>;
  restoreAccount(id: string): Promise<IpcResult<AccountDto>>;
  listAccountDefaults(
    accountId: string,
  ): Promise<IpcResult<readonly AccountInstrumentDefaultsDto[]>>;
  createCashMovement(input: CreateCashMovementDto): Promise<IpcResult<CashMovementDto>>;
  deleteCashMovement(id: string): Promise<IpcResult<CashMovementDto>>;
  listCashMovements(): Promise<IpcResult<readonly CashMovementDto[]>>;
  updateCashMovement(input: UpdateCashMovementDto): Promise<IpcResult<CashMovementDto>>;
  createTrade(input: CreateTradeDto): Promise<IpcResult<TradeDto>>;
  deleteTrade(id: string): Promise<IpcResult<TradeDto>>;
  deleteTrades(ids: readonly string[]): Promise<IpcResult<readonly TradeDto[]>>;
  getHistory(): Promise<IpcResult<HistoryStateDto>>;
  getInstrumentProfile(
    instrumentId: string,
  ): Promise<IpcResult<InstrumentCalculationProfileDto | null>>;
  getSettings(): Promise<IpcResult<ApplicationSettingsDto>>;
  getTradePreferences(): Promise<IpcResult<TradePreferencesDto>>;
  getTrade(id: string): Promise<IpcResult<TradeDto | null>>;
  getTradeSummary(input: TradeSummaryRequestDto): Promise<IpcResult<TradeSummaryDto | null>>;
  getAnalyticsReport(
    input: AnalyticsReportRequestDto,
  ): Promise<IpcResult<AnalyticsReportDto | null>>;
  listInstruments(): Promise<IpcResult<readonly InstrumentDto[]>>;
  listTags(): Promise<IpcResult<readonly TagDto[]>>;
  createTag(input: CreateTagDto): Promise<IpcResult<TagDto>>;
  updateTag(input: UpdateTagDto): Promise<IpcResult<TagDto>>;
  deleteTags(ids: readonly string[]): Promise<IpcResult<readonly TagDto[]>>;
  getTagTradeCounts(): Promise<IpcResult<Readonly<Record<string, number>>>>;
  getJournalPage(input: JournalPageRequestDto): Promise<IpcResult<JournalPageDto>>;
  redo(): Promise<IpcResult<HistoryStateDto>>;
  undo(): Promise<IpcResult<HistoryStateDto>>;
  updateSettings(input: ApplicationSettingsDto): Promise<IpcResult<ApplicationSettingsDto>>;
  updateInstrumentProfile(
    input: InstrumentCalculationProfileDto,
  ): Promise<IpcResult<InstrumentCalculationProfileDto>>;
  updateTradePreferences(input: UpdateTradePreferencesDto): Promise<IpcResult<TradePreferencesDto>>;
  updateTrade(input: TradeDto): Promise<IpcResult<TradeDto>>;
}
