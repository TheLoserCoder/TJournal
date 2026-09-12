export type ThemeMode = 'auto' | 'dark' | 'light';

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
  readonly instrument: string;
  readonly resultKind: 'cash' | 'percent';
  readonly resultValue: string;
}

export interface CreateTradeDto {
  readonly closedAt: string;
  readonly instrument: string;
  readonly resultKind: 'cash' | 'percent';
  readonly resultValue: string;
}

export interface DesktopApi {
  readonly diagnostics: {
    getStatus(): Promise<IpcResult<AppDiagnosticsDto>>;
  };
  readonly trades: {
    create(input: CreateTradeDto): Promise<IpcResult<TradeDto>>;
    list(): Promise<IpcResult<readonly TradeDto[]>>;
  };
  readonly vault: {
    create(): Promise<IpcResult<VaultDto | null>>;
    open(): Promise<IpcResult<VaultDto | null>>;
  };
}
