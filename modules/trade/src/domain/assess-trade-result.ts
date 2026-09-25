import Decimal from 'decimal.js';

import {
  TRADE_RESULT_KINDS,
  type ClosedTrade,
  type NeutralCostSettings,
  type NeutralRange,
  type TradeResultKind,
} from './trade';

export const TRADE_RESULT_TONES = {
  negative: 'negative',
  neutral: 'neutral',
  positive: 'positive',
} as const;
export type TradeResultTone = (typeof TRADE_RESULT_TONES)[keyof typeof TRADE_RESULT_TONES];

const DEFAULT_NEUTRAL_RANGE: NeutralRange = { lower: '0', upper: '0' };

export interface TradeResultAssessmentOptions {
  readonly metric: TradeResultKind;
  readonly neutralCostSettings: NeutralCostSettings;
  readonly neutralRange: NeutralRange | null;
}

type AssessableTrade = Pick<
  ClosedTrade,
  'account' | 'netResultUsd' | 'resultKind' | 'resultValue' | 'riskBindingSnapshot'
>;

export const getTradeMetricValue = (
  trade: AssessableTrade,
  metric: TradeResultKind,
): Decimal | null => {
  if (metric === TRADE_RESULT_KINDS.cash && trade.netResultUsd !== undefined)
    return new Decimal(trade.netResultUsd);
  if (trade.resultKind === metric) return new Decimal(trade.resultValue);
  if (
    metric === TRADE_RESULT_KINDS.cash &&
    trade.account?.balanceImpactUsd !== null &&
    trade.account?.balanceImpactUsd !== undefined
  ) {
    return new Decimal(trade.account.balanceImpactUsd);
  }
  if (
    trade.resultKind === TRADE_RESULT_KINDS.r &&
    (metric === TRADE_RESULT_KINDS.cash || metric === TRADE_RESULT_KINDS.percent) &&
    trade.riskBindingSnapshot?.kind === metric
  ) {
    return new Decimal(trade.resultValue).mul(trade.riskBindingSnapshot.value);
  }
  return null;
};

export const getTradeNeutralAssessmentValue = (
  trade: AssessableTrade,
  options: TradeResultAssessmentOptions,
): Decimal | null => {
  // Costs are already part of the authoritative net USD result when execution data exists.
  // Reapplying them here would charge commission or spread twice.
  return getTradeMetricValue(trade, options.metric);
};

export const classifyTradeResult = (
  trade: AssessableTrade,
  options: TradeResultAssessmentOptions,
): TradeResultTone | null => {
  const value = getTradeNeutralAssessmentValue(trade, options);
  if (value === null) return null;
  return classifyTradeResultValue(value.toString(), options.neutralRange);
};

export const classifyTradeResultValue = (
  value: string,
  neutralRange: NeutralRange | null,
): TradeResultTone => {
  const range = neutralRange ?? DEFAULT_NEUTRAL_RANGE;
  const lower = new Decimal(range.lower);
  const upper = new Decimal(range.upper);
  const decimalValue = new Decimal(value);
  if (decimalValue.greaterThan(upper)) return TRADE_RESULT_TONES.positive;
  if (decimalValue.lessThan(lower)) return TRADE_RESULT_TONES.negative;
  return TRADE_RESULT_TONES.neutral;
};
