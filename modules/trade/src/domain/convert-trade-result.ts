import Decimal from 'decimal.js';

import { TRADE_RESULT_KINDS, type TradeResultKind } from './trade';

export const TRADE_RESULT_CONVERSIONS = {
  cash: 'cash',
  percent: 'percent-of-balance',
  r: 'r-cash-risk',
} as const;
export type TradeResultConversion =
  (typeof TRADE_RESULT_CONVERSIONS)[keyof typeof TRADE_RESULT_CONVERSIONS];

export interface ConvertedTradeResult {
  readonly conversion: TradeResultConversion;
  readonly netResultUsd: string;
  readonly conversionBalanceUsd: string | null;
  readonly initialRiskUsd: string | null;
}

export const convertTradeResult = (
  kind: TradeResultKind,
  inputValue: string,
  balanceUsd: string,
  riskUsd: string | null,
): ConvertedTradeResult => {
  if (kind === TRADE_RESULT_KINDS.cash)
    return {
      conversion: TRADE_RESULT_CONVERSIONS.cash,
      netResultUsd: new Decimal(inputValue).toFixed(),
      conversionBalanceUsd: null,
      initialRiskUsd: null,
    };
  if (kind === TRADE_RESULT_KINDS.percent)
    return {
      conversion: TRADE_RESULT_CONVERSIONS.percent,
      netResultUsd: new Decimal(balanceUsd).mul(inputValue).div(100).toFixed(),
      conversionBalanceUsd: balanceUsd,
      initialRiskUsd: null,
    };
  if (riskUsd === null) throw new Error('R conversion requires a positive initial risk.');
  return {
    conversion: TRADE_RESULT_CONVERSIONS.r,
    netResultUsd: new Decimal(inputValue).mul(riskUsd).toFixed(),
    conversionBalanceUsd: null,
    initialRiskUsd: riskUsd,
  };
};
