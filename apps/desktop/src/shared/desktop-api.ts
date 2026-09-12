export type ThemeMode = 'auto' | 'dark' | 'light';
export type LanguageMode = 'en' | 'ru' | 'system';
export type InstrumentCategory =
  'crypto' | 'energy' | 'equity' | 'etf' | 'forex' | 'index' | 'metal';

export interface SafeErrorDto {
  readonly code:
    | 'configuration-invalid'
    | 'storage-integrity-failed'
    | 'unexpected'
    | 'vault-already-initialized'
    | 'vault-invalid'
    | 'vault-not-accessible';
  readonly retryable: boolean;
}

export type IpcResult<T> =
  { readonly ok: true; readonly value: T } | { readonly error: SafeErrorDto; readonly ok: false };

export interface AppDiagnosticsDto {
  readonly appName: string;
  readonly appVersion: string;
  readonly logsDirectory: string;
  readonly vaultPath: string | null;
}

export interface VaultDto {
  readonly path: string;
}

export interface TradeDto {
  readonly closedAt: string;
  readonly id: string;
  readonly instrumentId: string;
  readonly instrumentSymbol: string;
  readonly resultKind: 'cash' | 'percent';
  readonly resultValue: string;
}

export interface CreateTradeDto {
  readonly closedAt: string;
  readonly instrumentId: string;
  readonly resultKind: 'cash' | 'percent';
  readonly resultValue: string;
}

export interface InstrumentDto {
  readonly category: InstrumentCategory;
  readonly createdAt: string;
  readonly id: string;
  readonly source: 'custom' | 'seed';
  readonly symbol: string;
}

export interface CreateInstrumentDto {
  readonly category: InstrumentCategory;
  readonly symbol: string;
}

export interface ApplicationSettingsDto {
  readonly languageMode: LanguageMode;
  readonly themeMode: ThemeMode;
}

export interface HistoryStateDto {
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  readonly redoLabel: string | null;
  readonly undoLabel: string | null;
}

export interface DesktopApi {
  readonly diagnostics: {
    getStatus(): Promise<IpcResult<AppDiagnosticsDto>>;
  };
  readonly history: {
    getState(): Promise<IpcResult<HistoryStateDto>>;
    redo(): Promise<IpcResult<HistoryStateDto>>;
    undo(): Promise<IpcResult<HistoryStateDto>>;
  };
  readonly instruments: {
    create(input: CreateInstrumentDto): Promise<IpcResult<InstrumentDto>>;
    list(): Promise<IpcResult<readonly InstrumentDto[]>>;
  };
  readonly settings: {
    get(): Promise<IpcResult<ApplicationSettingsDto>>;
    update(input: ApplicationSettingsDto): Promise<IpcResult<ApplicationSettingsDto>>;
  };
  readonly trades: {
    create(input: CreateTradeDto): Promise<IpcResult<TradeDto>>;
    delete(id: string): Promise<IpcResult<TradeDto>>;
    list(): Promise<IpcResult<readonly TradeDto[]>>;
    update(input: TradeDto): Promise<IpcResult<TradeDto>>;
  };
  readonly vault: {
    create(): Promise<IpcResult<VaultDto | null>>;
    open(): Promise<IpcResult<VaultDto | null>>;
  };
}
