import Decimal from 'decimal.js';

import {
  type ClosedTrade,
  type NeutralCostSettings,
  type NeutralRange,
  type TradeResultKind,
} from '@tjournal/trade';
import {
  TRADE_RESULT_TONES,
  classifyTradeResult,
  getTradeMetricValue,
} from './assess-trade-result';

export const SUMMARY_PERIODS = {
  all: 'all',
  currentDay: 'current-day',
  currentMonth: 'current-month',
  currentQuarter: 'current-quarter',
  currentWeek: 'current-week',
  currentYear: 'current-year',
} as const;
export type SummaryPeriod = (typeof SUMMARY_PERIODS)[keyof typeof SUMMARY_PERIODS];

export interface TradeSummaryQuery {
  readonly filters?: {
    readonly closedFrom: string | null;
    readonly closedTo: string | null;
    readonly instrumentIds: readonly string[] | null;
    readonly resultKinds: readonly TradeResultKind[] | null;
    readonly accountIds?: readonly string[] | null;
    readonly includeUnassigned?: boolean;
  } | null;
  readonly metric: TradeResultKind;
  readonly neutralCostSettings: NeutralCostSettings;
  readonly neutralRange: NeutralRange | null;
  readonly now: Date;
  readonly period: SummaryPeriod;
}

export interface TradeSummary {
  readonly bestInstrument: string | null;
  readonly coveredTrades: number;
  readonly losingTrades: number | null;
  readonly neutralTrades: number | null;
  readonly totalResult: string | null;
  readonly totalTrades: number;
  readonly winRate: string | null;
  readonly winningTrades: number | null;
  readonly worstInstrument: string | null;
}

const startOfPeriod = (period: SummaryPeriod, now: Date): Date | null => {
  if (period === SUMMARY_PERIODS.all) return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === SUMMARY_PERIODS.currentWeek) {
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
  } else if (period === SUMMARY_PERIODS.currentMonth) {
    start.setDate(1);
  } else if (period === SUMMARY_PERIODS.currentQuarter) {
    start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
  } else if (period === SUMMARY_PERIODS.currentYear) {
    start.setMonth(0, 1);
  }
  return start;
};

export const calculateTradeSummary = (
  trades: readonly ClosedTrade[],
  query: TradeSummaryQuery,
): TradeSummary => {
  const start = startOfPeriod(query.period, query.now);
  const periodTrades =
    start === null
      ? trades
      : trades.filter((trade) => new Date(trade.closedAt).getTime() >= start.getTime());
  const filteredTrades = periodTrades.filter((trade) => {
    const filters = query.filters;
    if (filters === undefined || filters === null) return true;
    if (filters.instrumentIds !== null && !filters.instrumentIds.includes(trade.instrumentId)) {
      return false;
    }
    if (filters.resultKinds !== null && !filters.resultKinds.includes(trade.resultKind)) {
      return false;
    }
    if (filters.accountIds !== undefined && filters.accountIds !== null) {
      const assigned = trade.account?.accountId;
      const matchesAccount = assigned !== undefined && filters.accountIds.includes(assigned);
      const matchesUnassigned =
        filters.includeUnassigned === true && (assigned === undefined || assigned === null);
      if (!matchesAccount && !matchesUnassigned) return false;
    }
    const closedAt = new Date(trade.closedAt).getTime();
    if (filters.closedFrom !== null && closedAt < new Date(filters.closedFrom).getTime()) {
      return false;
    }
    if (filters.closedTo !== null && closedAt > new Date(filters.closedTo).getTime()) return false;
    return true;
  });
  const values = filteredTrades.flatMap((trade) => {
    const value = getTradeMetricValue(trade, query.metric);
    const tone = classifyTradeResult(trade, query);
    return value === null || tone === null
      ? []
      : [{ instrumentId: trade.instrumentId, symbol: trade.instrumentSymbol, tone, value }];
  });
  const total = values.reduce((sum, item) => sum.plus(item.value), new Decimal(0));
  const byInstrument = new Map<string, { symbol: string; total: Decimal }>();
  for (const item of values) {
    const previous = byInstrument.get(item.instrumentId);
    byInstrument.set(item.instrumentId, {
      symbol: item.symbol,
      total: (previous?.total ?? new Decimal(0)).plus(item.value),
    });
  }
  const ordered = [...byInstrument].sort(([leftId, left], [rightId, right]) => {
    const comparison = right.total.comparedTo(left.total);
    return comparison === 0
      ? left.symbol.localeCompare(right.symbol) || leftId.localeCompare(rightId)
      : comparison;
  });
  const bestInstrument = ordered.find(([, value]) => value.total.isPositive())?.[1].symbol ?? null;
  const worstInstrument =
    [...ordered].reverse().find(([, value]) => value.total.isNegative())?.[1].symbol ?? null;

  const winningTrades = values.filter(({ tone }) => tone === TRADE_RESULT_TONES.positive).length;
  const losingTrades = values.filter(({ tone }) => tone === TRADE_RESULT_TONES.negative).length;
  const neutralTrades = values.length - winningTrades - losingTrades;
  const decided = winningTrades + losingTrades;

  return {
    bestInstrument,
    coveredTrades: values.length,
    losingTrades,
    neutralTrades,
    totalResult: values.length === 0 ? null : total.toString(),
    totalTrades: filteredTrades.length,
    winRate: decided === 0 ? null : new Decimal(winningTrades).div(decided).mul(100).toString(),
    winningTrades,
    worstInstrument,
  };
};
