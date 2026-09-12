import type {
  ApplicationSettingsDto,
  CreateInstrumentDto,
  CreateTradeDto,
  HistoryStateDto,
  InstrumentDto,
  IpcResult,
  TradeDto,
} from '../../shared/desktop-api';

export interface RendererGateway {
  createInstrument(input: CreateInstrumentDto): Promise<IpcResult<InstrumentDto>>;
  createTrade(input: CreateTradeDto): Promise<IpcResult<TradeDto>>;
  deleteTrade(id: string): Promise<IpcResult<TradeDto>>;
  getHistory(): Promise<IpcResult<HistoryStateDto>>;
  getSettings(): Promise<IpcResult<ApplicationSettingsDto>>;
  listInstruments(): Promise<IpcResult<readonly InstrumentDto[]>>;
  listTrades(): Promise<IpcResult<readonly TradeDto[]>>;
  redo(): Promise<IpcResult<HistoryStateDto>>;
  undo(): Promise<IpcResult<HistoryStateDto>>;
  updateSettings(input: ApplicationSettingsDto): Promise<IpcResult<ApplicationSettingsDto>>;
  updateTrade(input: TradeDto): Promise<IpcResult<TradeDto>>;
}
