import type { TagColorId } from '@tjournal/tag';

export type { TagColorId };

export type ThemeMode = 'auto' | 'dark' | 'light';
export type LanguageMode = 'en' | 'ru' | 'system';
export const TABLE_IDENTIFIERS = {
  accounts: 'accounts',
  assets: 'assets',
  tags: 'tags',
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
export type AnalyticsTimeGrain = 'auto' | 'day' | 'hour' | 'week' | 'month';
export type AnalyticsEffectiveTimeGrain = Exclude<AnalyticsTimeGrain, 'auto'> | 'year';
export type AnalyticsBreakdownDimension = 'account' | 'category' | 'instrument';
export type AnalyticsBreakdownMetric = 'net-result' | 'trade-count' | 'win-rate';
export type StatisticsChartType = 'bar' | 'line';
export type StatisticsChartMetric = 'cumulative-net-result' | 'drawdown' | 'period-net-result';

export interface SafeErrorDto {
  readonly code:
    | 'backup-failed'
    | 'backup-invalid'
    | 'configuration-invalid'
    | 'storage-integrity-failed'
    | 'restore-failed'
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

export interface VaultBackupDto {
  readonly id: string;
  readonly kind: 'automatic' | 'manual';
  readonly createdAt: string;
  readonly sourceVaultId: string;
  readonly databaseBytes: number;
}

export interface VaultBackupPageDto {
  readonly backups: readonly VaultBackupDto[];
  readonly nextCursor: string | null;
}

export type JournalPageSortField = 'account' | 'asset' | 'date' | 'result' | 'type';
export type JournalPageEntryKind = 'deposit' | 'long' | 'short' | 'withdrawal';
export type JournalPageBoundMode = 'between' | 'equals' | 'greaterThan' | 'lessThan';

export interface JournalPageResultBoundsDto {
  readonly maximum: string | null;
  readonly minimum: string | null;
  readonly mode: JournalPageBoundMode;
}

export type JournalPageDetailNumericField =
  'commission' | 'entryPrice' | 'exitCount' | 'quantity' | 'spread' | 'stopLoss';
export type JournalPageNotePresence = 'entry' | 'review';

export interface JournalPageFiltersDto {
  readonly accountIds: readonly string[];
  readonly categories: readonly InstrumentCategory[];
  readonly closedFromDate: string | null;
  readonly closedToDate: string | null;
  readonly detailBounds: Readonly<
    Partial<Record<JournalPageDetailNumericField, JournalPageResultBoundsDto>>
  > | null;
  readonly entryKinds: readonly JournalPageEntryKind[];
  readonly includeUntagged: boolean;
  readonly includeUnassigned: boolean;
  readonly instrumentIds: readonly string[];
  readonly notePresence: readonly JournalPageNotePresence[];
  readonly occurredFrom: string | null;
  readonly occurredTo: string | null;
  readonly resultBounds: JournalPageResultBoundsDto | null;
  readonly resultUnits: readonly TradeResultKind[];
  readonly reviewStatuses: readonly ('unreviewed' | 'reviewed')[];
  readonly tagIds: readonly string[];
  readonly textQuery: string | null;
}

export interface JournalPageRequestDto {
  readonly cursor: string | null;
  readonly filters: JournalPageFiltersDto;
  readonly includeCashMovements: boolean;
  readonly limit: number;
  readonly sort: {
    readonly direction: 'asc' | 'desc';
    readonly field: JournalPageSortField;
  };
}

/**
 * Bounded trade-detail projection carried with every page row so the table can
 * render execution columns without loading the full trade aggregate. Note
 * contents and exit rows remain in the point lookup.
 */
export interface JournalPageTradeDetailsDto {
  readonly commissionUsd: string | null;
  readonly entryPrice: string | null;
  readonly exitCount: number;
  readonly hasEntryNote: boolean;
  readonly hasReviewNote: boolean;
  readonly quantityLots: string | null;
  readonly reviewStatus: 'unreviewed' | 'reviewed';
  readonly spreadTicks: string | null;
  readonly stopLossPrice: string | null;
}

export type JournalPageTradeDto = Omit<
  TradeDto,
  'entryNote' | 'execution' | 'reviewNote' | 'reviewStatus'
> &
  JournalPageTradeDetailsDto;

export type JournalPageRowDto =
  | {
      readonly id: string;
      readonly kind: 'trade';
      readonly occurredAt: string;
      readonly trade: JournalPageTradeDto;
    }
  | {
      readonly id: string;
      readonly kind: 'deposit' | 'withdrawal';
      readonly movement: CashMovementDto;
      readonly occurredAt: string;
    };

export interface JournalPageDto {
  readonly nextCursor: string | null;
  readonly previousCursor: string | null;
  readonly rows: readonly JournalPageRowDto[];
  readonly totalEntryCount: number;
  readonly unassignedTradeCount: number;
}

export interface TradeDto {
  readonly account?: AccountAttributionSnapshotDto | null;
  readonly closedAt: string;
  readonly direction: TradeDirection | null;
  readonly entryNote: string | null;
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
  readonly reviewNote: string | null;
  readonly reviewStatus: 'unreviewed' | 'reviewed';
  readonly riskBindingSnapshot: RiskBindingSnapshotDto | null;
  readonly tagIds: readonly string[];
}

export interface TagDto {
  readonly color: TagColorId;
  readonly createdAt: string;
  readonly description: string;
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
}

export interface CreateTagDto {
  readonly color?: TagColorId;
  readonly description?: string;
  readonly name: string;
}

export interface UpdateTagDto {
  readonly color: TagColorId;
  readonly description: string;
  readonly id: string;
  readonly name: string;
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
  /** Calculation ticks live with the account cost profile, nullable when unset. */
  readonly tickSize: string | null;
  readonly tickValueUsdPerLot: string | null;
  readonly updatedAt: string;
}

export type AccountInstrumentDefaultsInputDto = Omit<
  AccountInstrumentDefaultsDto,
  'accountId' | 'tickSize' | 'tickValueUsdPerLot' | 'updatedAt'
> & {
  readonly tickSize?: string | null;
  readonly tickValueUsdPerLot?: string | null;
};

export interface CreateAccountDto {
  readonly name: string;
  readonly openingBalanceUsd: string;
  readonly defaultRiskUsd?: string | null;
  readonly defaults: readonly AccountInstrumentDefaultsInputDto[];
}

export interface UpdateAccountDto extends CreateAccountDto {
  readonly id: string;
}

export interface CreateTradeDto {
  readonly closedAt: string;
  readonly direction: TradeDirection;
  readonly entryNote?: string | null;
  readonly execution: TradeExecutionInputDto | null;
  readonly instrumentId: string;
  readonly reviewNote?: string | null;
  readonly reviewStatus?: 'unreviewed' | 'reviewed';
  readonly resultKind: TradeResultKind;
  readonly resultValue: string;
  readonly accountId: string;
  readonly riskUsd?: string;
  readonly tagIds?: readonly string[];
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
  readonly period: SummaryPeriod;
}
export interface TradeSummaryFilterDto {
  readonly closedFrom: string | null;
  readonly closedTo: string | null;
  readonly instrumentIds: readonly string[] | null;
  readonly resultKinds: readonly TradeResultKind[] | null;
  readonly accountIds?: readonly string[] | null;
  readonly includeUnassigned?: boolean;
  /** Trade-level kinds derived from the entry type filter: trades, deposits or withdrawals. */
  readonly entryKinds?: readonly SummaryEntryKind[] | null;
  /** Inclusive bounds on the authoritative USD result. */
  readonly netResultBounds?: TradeSummaryNumericBoundsDto | null;
  /** Original quick-entry units (`cash`, `percent`, `r`). */
  readonly resultUnits?: readonly TradeResultKind[] | null;
  /** Case-insensitive substring match on the trade identifier. */
  readonly textQuery?: string | null;
}
export type SummaryEntryKind = 'trade' | 'deposit' | 'withdrawal';
export interface TradeSummaryNumericBoundsDto {
  readonly maximum: string | null;
  readonly minimum: string | null;
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

export interface AnalyticsReportRequestDto {
  readonly breakdown: {
    readonly dimension: AnalyticsBreakdownDimension;
    readonly limit: number;
    readonly metric: AnalyticsBreakdownMetric;
  };
  readonly filters: {
    readonly accountIds: readonly string[];
    readonly categories: readonly InstrumentCategory[];
    readonly directions: readonly TradeDirection[];
    readonly includeUnassigned: boolean;
    readonly instrumentIds: readonly string[];
  };
  readonly range: {
    readonly fromInclusive: string | null;
    readonly toExclusive: string | null;
  };
  readonly timeGrain: AnalyticsTimeGrain;
}

export interface AnalyticsBreakdownRowDto {
  readonly averageTradeUsd: string | null;
  readonly coveredTrades: number;
  readonly id: string;
  readonly label: string;
  readonly losingTrades: number;
  readonly maxDrawdownUsd: string | null;
  readonly netResultUsd: string;
  readonly neutralTrades: number;
  readonly profitFactor: string | null;
  readonly totalTrades: number;
  readonly winRatePercent: string | null;
  readonly winningTrades: number;
}

export interface AnalyticsSeriesPointDto {
  readonly bucketEnd: string;
  readonly bucketStart: string;
  readonly coveredTrades: number;
  readonly cumulativeNetResultUsd: string;
  readonly drawdownUsd: string;
  readonly netResultUsd: string;
}

export interface AnalyticsReportDto {
  readonly breakdown: {
    readonly dimension: AnalyticsBreakdownDimension;
    readonly metric: AnalyticsBreakdownMetric;
    readonly omittedGroupCount: number;
    readonly rows: readonly AnalyticsBreakdownRowDto[];
    readonly totalGroupCount: number;
  };
  readonly coverage: {
    readonly coveredTrades: number;
    readonly excludedTrades: number;
    readonly totalTrades: number;
  };
  readonly effectiveRange: {
    readonly fromInclusive: string | null;
    readonly grain: AnalyticsEffectiveTimeGrain;
    readonly toExclusive: string | null;
  };
  readonly highlights: {
    readonly bestInstrument: AnalyticsBreakdownRowDto | null;
    readonly worstInstrument: AnalyticsBreakdownRowDto | null;
  };
  readonly kpis: {
    readonly averageTradeUsd: string | null;
    readonly grossLossMagnitudeUsd: string | null;
    readonly grossProfitUsd: string | null;
    readonly losingTrades: number;
    readonly maxDrawdownUsd: string | null;
    readonly netResultUsd: string | null;
    readonly neutralTrades: number;
    readonly profitFactor: string | null;
    readonly winRatePercent: string | null;
    readonly winningTrades: number;
  };
  readonly series: readonly AnalyticsSeriesPointDto[];
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
  readonly statisticsView: StatisticsViewPreferencesDto;
}

export interface StatisticsViewPreferencesDto {
  readonly breakdownDimension: AnalyticsBreakdownDimension;
  readonly breakdownMetric: AnalyticsBreakdownMetric;
  readonly chartMetric: StatisticsChartMetric;
  readonly chartType: StatisticsChartType;
  readonly timeGrain: AnalyticsTimeGrain;
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
  tags: 'tags',
  tradePreferences: 'trade-preferences',
  trades: 'trades',
  tradeTags: 'trade-tags',
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
    get(id: string): Promise<IpcResult<TradeDto | null>>;
    page(input: JournalPageRequestDto): Promise<IpcResult<JournalPageDto>>;
    update(input: TradeDto): Promise<IpcResult<TradeDto>>;
  };
  readonly tags: {
    counts(): Promise<IpcResult<Readonly<Record<string, number>>>>;
    create(input: CreateTagDto): Promise<IpcResult<TagDto>>;
    deleteMany(ids: readonly string[]): Promise<IpcResult<readonly TagDto[]>>;
    list(): Promise<IpcResult<readonly TagDto[]>>;
    update(input: UpdateTagDto): Promise<IpcResult<TagDto>>;
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
    report(input: AnalyticsReportRequestDto): Promise<IpcResult<AnalyticsReportDto | null>>;
    summary(input: TradeSummaryRequestDto): Promise<IpcResult<TradeSummaryDto | null>>;
  };
  readonly vault: {
    backup(): Promise<IpcResult<VaultBackupDto>>;
    backups(beforeId?: string | null): Promise<IpcResult<VaultBackupPageDto>>;
    verifyBackup(id: string): Promise<IpcResult<VaultBackupDto>>;
    restoreBackup(id: string): Promise<IpcResult<VaultDto | null>>;
    create(): Promise<IpcResult<VaultDto | null>>;
    open(): Promise<IpcResult<VaultDto | null>>;
    revealInFolder(): Promise<IpcResult<VaultDto>>;
    validate(): Promise<IpcResult<VaultDto>>;
  };
}
