export type ThemeMode = 'auto' | 'dark' | 'light';
export type LanguageMode = 'en' | 'ru' | 'system';
export const TABLE_IDENTIFIERS = {
  accounts: 'accounts',
  assets: 'assets',
  trades: 'trades',
} as const;
export type TableIdentifier = (typeof TABLE_IDENTIFIERS)[keyof typeof TABLE_IDENTIFIERS];
export const TABLE_DISPLAY_MODES = { advanced: 'advanced', compact: 'compact' } as const;
export type TableDisplayMode = (typeof TABLE_DISPLAY_MODES)[keyof typeof TABLE_DISPLAY_MODES];
export type InstrumentCategory =
  'crypto' | 'energy' | 'equity' | 'etf' | 'forex' | 'index' | 'metal';
export type TradeDirection = 'long' | 'short';
export type TradeResultKind = 'cash' | 'percent' | 'r';
export type CashMovementKind = 'deposit' | 'withdrawal';
export type SummaryPeriod =
  'all' | 'current-day' | 'current-month' | 'current-quarter' | 'current-week' | 'current-year';

export interface SafeErrorDto {
  readonly code:
    | 'configuration-invalid'
    | 'storage-integrity-failed'
    | 'validation-invalid'
    | 'unexpected'
    | 'vault-already-initialized'
    | 'vault-invalid'
    | 'vault-not-accessible';
  readonly retryable: boolean;
  readonly issues?: readonly ValidationIssueDto[];
}

export interface ValidationIssueDto {
  readonly code: string;
  readonly path: string;
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
  readonly account?: AccountAttributionSnapshotDto | null;
  readonly closedAt: string;
  readonly direction: TradeDirection | null;
  readonly execution: TradeExecutionDto | null;
  readonly id: string;
  readonly inputResultKind?: TradeResultKind;
  readonly inputResultValue?: string;
  readonly instrumentId: string;
  readonly instrumentSymbol: string;
  readonly netResultUsd?: string;
  readonly resultKind: TradeResultKind;
  readonly resultSource: 'calculated' | 'manual';
  readonly resultValue: string;
  readonly riskBindingSnapshot: RiskBindingSnapshotDto | null;
}

export interface AccountAttributionSnapshotDto {
  readonly accountId: string;
  readonly accountName: string;
  readonly balanceBeforeUsd: string;
  readonly balanceImpactUsd: string | null;
  readonly conversionBalanceUsd?: string | null;
  readonly conversion: 'cash' | 'percent-of-balance' | 'r-cash-risk' | 'r-percent-risk' | null;
  readonly initialRiskUsd?: string | null;
}

export interface AccountDto {
  readonly id: string;
  readonly name: string;
  readonly openingBalanceUsd: string;
  readonly defaultRiskUsd: string | null;
  readonly currentKnownBalanceUsd: string;
  readonly uncoveredTradeCount: number;
  readonly configuredAssetsCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
}

export interface AccountInstrumentDefaultsDto {
  readonly accountId: string;
  readonly instrumentId: string;
  readonly commissionUsd: string;
  readonly spreadTicks: string;
  readonly updatedAt: string;
}

export interface CreateAccountDto {
  readonly name: string;
  readonly openingBalanceUsd: string;
  readonly defaults: readonly Omit<AccountInstrumentDefaultsDto, 'accountId' | 'updatedAt'>[];
}

export interface UpdateAccountDto extends CreateAccountDto {
  readonly id: string;
}

export interface CreateTradeDto {
  readonly closedAt: string;
  readonly direction: TradeDirection;
  readonly execution: TradeExecutionInputDto | null;
  readonly instrumentId: string;
  readonly resultKind: TradeResultKind;
  readonly resultValue: string;
  readonly accountId: string;
  readonly riskUsd?: string;
}

export interface CashMovementDto {
  readonly accountId: string;
  readonly accountName: string;
  readonly amountUsd: string;
  readonly occurredAt: string;
  readonly id: string;
  readonly kind: CashMovementKind;
}

export interface CreateCashMovementDto {
  readonly accountId: string;
  readonly amountUsd: string;
  readonly occurredAt: string;
  readonly kind: CashMovementKind;
}

export interface UpdateCashMovementDto extends CreateCashMovementDto {
  readonly id: string;
}

export interface RiskBindingDto {
  readonly kind: 'cash' | 'percent';
  readonly value: string;
}
export interface RiskBindingSnapshotDto extends RiskBindingDto {
  readonly source: 'vault-default';
}
export interface TradeExitDto {
  readonly allocationKind: 'lots' | 'percent';
  readonly allocationValue: string;
  readonly exitPrice: string;
  readonly id: string;
  readonly order: number;
  readonly reportedResultKind: 'cash' | 'percent' | null;
  readonly reportedResultValue: string | null;
}
export interface TradeExecutionInputDto {
  readonly commissionUsd: string;
  readonly entryPrice: string;
  readonly exits: readonly TradeExitDto[];
  readonly quantityLots: string;
  readonly spreadTicks: string;
  readonly stopLossPrice: string | null;
}
export interface TradeExecutionDto extends TradeExecutionInputDto {
  readonly instrumentSnapshot: { readonly tickSize: string; readonly tickValueUsdPerLot: string };
}
export interface NeutralRangeDto {
  readonly lower: string;
  readonly upper: string;
}
export interface NeutralCostSettingsDto {
  readonly includeCommission: boolean;
  readonly includeSpread: boolean;
}
export interface TradePreferencesDto {
  readonly neutralCostSettings: NeutralCostSettingsDto;
  readonly neutralRanges: Readonly<Record<TradeResultKind, NeutralRangeDto | null>>;
  readonly riskBinding: RiskBindingDto | null;
  readonly riskPromptDismissed: boolean;
}
export interface UpdateTradePreferencesDto {
  readonly preferences: TradePreferencesDto;
  readonly rebindHistorical: boolean;
}
export interface InstrumentCalculationProfileDto {
  readonly instrumentId: string;
  readonly tickSize: string;
  readonly tickValueUsdPerLot: string;
  readonly updatedAt: string;
}
export interface TradeSummaryPreferencesDto {
  readonly followTableFilters: boolean;
  readonly metric: TradeResultKind;
  readonly period: SummaryPeriod;
}
export interface TradeSummaryFilterDto {
  readonly closedFrom: string | null;
  readonly closedTo: string | null;
  readonly instrumentIds: readonly string[] | null;
  readonly resultKinds: readonly TradeResultKind[] | null;
  readonly accountIds?: readonly string[] | null;
  readonly includeUnassigned?: boolean;
}
export interface TradeSummaryRequestDto {
  readonly filters: TradeSummaryFilterDto | null;
  readonly metric: TradeResultKind;
  readonly period: SummaryPeriod;
}
export interface TradeSummaryDto {
  readonly bestInstrument: string | null;
  readonly coveredTrades: number;
  readonly losingTrades: number | null;
  readonly neutralTrades: number | null;
  readonly totalResult: string | null;
  readonly totalTrades: number;
  readonly winRate: string | null;
  readonly winningTrades: number | null;
  readonly worstInstrument: string | null;
  readonly accountedBalanceUsd?: string;
}

export interface InstrumentDto {
  readonly category: InstrumentCategory;
  readonly createdAt: string;
  readonly id: string;
  readonly source: 'custom' | 'seed';
  readonly symbol: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
  readonly calculationProfile: InstrumentCalculationProfileDto | null;
}

export interface CreateInstrumentDto {
  readonly category: InstrumentCategory;
  readonly symbol: string;
  readonly calculationProfile?: Omit<
    InstrumentCalculationProfileDto,
    'instrumentId' | 'updatedAt'
  > | null;
}

export interface UpdateInstrumentDto extends CreateInstrumentDto {
  readonly id: string;
}

export interface ApplicationSettingsDto {
  readonly languageMode: LanguageMode;
  readonly tableLayouts: readonly TableLayoutDto[];
  readonly themeMode: ThemeMode;
  readonly tradeSummary: TradeSummaryPreferencesDto;
}

export interface TableColumnLayoutDto {
  readonly id: string;
  readonly visible: boolean;
  readonly width: number;
}

export interface TableLayoutDto {
  readonly columns: readonly TableColumnLayoutDto[];
  readonly id: TableIdentifier;
  readonly mode: TableDisplayMode;
  readonly order: readonly string[];
}

export interface HistoryStateDto {
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  readonly redoLabel: string | null;
  readonly undoLabel: string | null;
}

export const DATA_RESOURCES = {
  accounts: 'accounts',
  accountInstrumentDefaults: 'account-instrument-defaults',
  cashMovements: 'cash-movements',
  applicationSettings: 'application-settings',
  history: 'history',
  instrumentProfiles: 'instrument-profiles',
  instruments: 'instruments',
  tradePreferences: 'trade-preferences',
  trades: 'trades',
} as const;
export type DataResource = (typeof DATA_RESOURCES)[keyof typeof DATA_RESOURCES];

export interface CommittedDataChangeDto {
  readonly changeId: string;
  readonly resources: readonly DataResource[];
  readonly revisions: Readonly<Partial<Record<DataResource, number>>>;
  readonly vaultGeneration: string;
}

export interface DesktopApi {
  readonly changes: {
    subscribe(listener: (change: CommittedDataChangeDto) => void): () => void;
  };
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
    update(input: UpdateInstrumentDto): Promise<IpcResult<InstrumentDto>>;
    delete(id: string): Promise<IpcResult<InstrumentDto>>;
    restore(id: string): Promise<IpcResult<InstrumentDto>>;
  };
  readonly accounts: {
    create(input: CreateAccountDto): Promise<IpcResult<AccountDto>>;
    list(): Promise<IpcResult<readonly AccountDto[]>>;
    update(input: UpdateAccountDto): Promise<IpcResult<AccountDto>>;
    delete(id: string): Promise<IpcResult<AccountDto>>;
    restore(id: string): Promise<IpcResult<AccountDto>>;
    defaults(accountId: string): Promise<IpcResult<readonly AccountInstrumentDefaultsDto[]>>;
  };
  readonly cashMovements: {
    create(input: CreateCashMovementDto): Promise<IpcResult<CashMovementDto>>;
    delete(id: string): Promise<IpcResult<CashMovementDto>>;
    list(): Promise<IpcResult<readonly CashMovementDto[]>>;
    update(input: UpdateCashMovementDto): Promise<IpcResult<CashMovementDto>>;
  };
  readonly settings: {
    get(): Promise<IpcResult<ApplicationSettingsDto>>;
    update(input: ApplicationSettingsDto): Promise<IpcResult<ApplicationSettingsDto>>;
  };
  readonly trades: {
    create(input: CreateTradeDto): Promise<IpcResult<TradeDto>>;
    delete(id: string): Promise<IpcResult<TradeDto>>;
    deleteMany(ids: readonly string[]): Promise<IpcResult<readonly TradeDto[]>>;
    list(): Promise<IpcResult<readonly TradeDto[]>>;
    update(input: TradeDto): Promise<IpcResult<TradeDto>>;
  };
  readonly tradePreferences: {
    get(): Promise<IpcResult<TradePreferencesDto>>;
    update(input: UpdateTradePreferencesDto): Promise<IpcResult<TradePreferencesDto>>;
  };
  readonly instrumentProfiles: {
    get(instrumentId: string): Promise<IpcResult<InstrumentCalculationProfileDto | null>>;
    update(
      input: InstrumentCalculationProfileDto,
    ): Promise<IpcResult<InstrumentCalculationProfileDto>>;
  };
  readonly analytics: {
    summary(input: TradeSummaryRequestDto): Promise<IpcResult<TradeSummaryDto | null>>;
  };
  readonly vault: {
    create(): Promise<IpcResult<VaultDto | null>>;
    open(): Promise<IpcResult<VaultDto | null>>;
  };
}
