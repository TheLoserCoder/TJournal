export const TRADE_DIRECTIONS = { long: 'long', short: 'short' } as const;
export type TradeDirection = (typeof TRADE_DIRECTIONS)[keyof typeof TRADE_DIRECTIONS];

export const TRADE_RESULT_KINDS = { cash: 'cash', percent: 'percent', r: 'r' } as const;
export type TradeResultKind = (typeof TRADE_RESULT_KINDS)[keyof typeof TRADE_RESULT_KINDS];

export const TRADE_RESULT_SOURCES = { calculated: 'calculated', manual: 'manual' } as const;
export type TradeResultSource = (typeof TRADE_RESULT_SOURCES)[keyof typeof TRADE_RESULT_SOURCES];

export const EXIT_ALLOCATION_KINDS = { lots: 'lots', percent: 'percent' } as const;
export type ExitAllocationKind = (typeof EXIT_ALLOCATION_KINDS)[keyof typeof EXIT_ALLOCATION_KINDS];

export const RISK_BINDING_KINDS = { cash: 'cash', percent: 'percent' } as const;
export type RiskBindingKind = (typeof RISK_BINDING_KINDS)[keyof typeof RISK_BINDING_KINDS];

export interface RiskBinding {
  readonly kind: RiskBindingKind;
  readonly value: string;
}

export interface RiskBindingSnapshot extends RiskBinding {
  readonly source: 'vault-default';
}

export interface InstrumentCalculationSnapshot {
  readonly tickSize: string;
  readonly tickValueUsdPerLot: string;
}

export interface TradeExit {
  readonly allocationKind: ExitAllocationKind;
  readonly allocationValue: string;
  readonly exitPrice: string;
  readonly id: string;
  readonly order: number;
  readonly reportedResultKind: 'cash' | 'percent' | null;
  readonly reportedResultValue: string | null;
}

export interface TradeExecution {
  readonly commissionUsd: string;
  readonly entryPrice: string;
  readonly exits: readonly TradeExit[];
  readonly instrumentSnapshot: InstrumentCalculationSnapshot;
  readonly quantityLots: string;
  readonly spreadTicks: string;
  readonly stopLossPrice: string | null;
}

export type TradeExecutionInput = Omit<TradeExecution, 'instrumentSnapshot'>;

export interface ClosedTrade {
  readonly account?: AccountAttributionSnapshot | null;
  readonly closedAt: string;
  readonly direction: TradeDirection | null;
  readonly execution: TradeExecution | null;
  readonly id: string;
  readonly inputResultKind?: TradeResultKind;
  readonly inputResultValue?: string;
  readonly instrumentId: string;
  readonly instrumentSymbol: string;
  /** Null on legacy rows that have not yet been explicitly resolved. */
  readonly netResultUsd?: string;
  readonly resultKind: TradeResultKind;
  readonly resultSource: TradeResultSource;
  readonly resultValue: string;
  readonly riskBindingSnapshot: RiskBindingSnapshot | null;
}

export interface CreateClosedTradeInput {
  readonly accountId: string;
  readonly closedAt: string;
  readonly direction: TradeDirection;
  readonly execution: TradeExecutionInput | null;
  readonly instrumentId: string;
  readonly riskUsd?: string;
  readonly resultKind: TradeResultKind;
  readonly resultValue: string;
}

export interface AccountAttributionSnapshot {
  readonly accountId: string;
  readonly accountName: string;
  readonly balanceBeforeUsd: string;
  readonly balanceImpactUsd: string | null;
  readonly conversionBalanceUsd?: string | null;
  readonly conversion: 'cash' | 'percent-of-balance' | 'r-cash-risk' | 'r-percent-risk' | null;
  readonly initialRiskUsd?: string | null;
}

export interface InstrumentCalculationProfile {
  readonly instrumentId: string;
  readonly tickSize: string;
  readonly tickValueUsdPerLot: string;
  readonly updatedAt: string;
}

export interface NeutralRange {
  readonly lower: string;
  readonly upper: string;
}

export interface NeutralCostSettings {
  readonly includeCommission: boolean;
  readonly includeSpread: boolean;
}

export interface TradePreferences {
  readonly neutralCostSettings: NeutralCostSettings;
  readonly neutralRanges: Readonly<Record<TradeResultKind, NeutralRange | null>>;
  readonly riskBinding: RiskBinding | null;
  readonly riskPromptDismissed: boolean;
}
