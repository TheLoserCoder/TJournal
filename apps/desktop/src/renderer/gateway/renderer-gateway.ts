import type {
  ApplicationSettingsDto,
  AppDiagnosticsDto,
  AccountDto,
  AccountInstrumentDefaultsDto,
  CashMovementDto,
  CreateCashMovementDto,
  CreateAccountDto,
  CommittedDataChangeDto,
  CreateInstrumentDto,
  CreateTradeDto,
  HistoryStateDto,
  InstrumentDto,
  UpdateAccountDto,
  UpdateInstrumentDto,
  IpcResult,
  TradeDto,
  TradePreferencesDto,
  InstrumentCalculationProfileDto,
  TradeSummaryDto,
  TradeSummaryRequestDto,
  UpdateTradePreferencesDto,
  UpdateCashMovementDto,
} from '../../shared/desktop-api';

export interface RendererGateway {
  getDiagnostics(): Promise<IpcResult<AppDiagnosticsDto>>;
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
  getTradeSummary(input: TradeSummaryRequestDto): Promise<IpcResult<TradeSummaryDto | null>>;
  listInstruments(): Promise<IpcResult<readonly InstrumentDto[]>>;
  listTrades(): Promise<IpcResult<readonly TradeDto[]>>;
  redo(): Promise<IpcResult<HistoryStateDto>>;
  undo(): Promise<IpcResult<HistoryStateDto>>;
  updateSettings(input: ApplicationSettingsDto): Promise<IpcResult<ApplicationSettingsDto>>;
  updateInstrumentProfile(
    input: InstrumentCalculationProfileDto,
  ): Promise<IpcResult<InstrumentCalculationProfileDto>>;
  updateTradePreferences(input: UpdateTradePreferencesDto): Promise<IpcResult<TradePreferencesDto>>;
  updateTrade(input: TradeDto): Promise<IpcResult<TradeDto>>;
}
