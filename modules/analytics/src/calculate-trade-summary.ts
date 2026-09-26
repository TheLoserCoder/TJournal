import Decimal from 'decimal.js';

import {
  TRADE_RESULT_KINDS,
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
import type { TradeSummaryFact } from './contracts/trade-summary-fact-source';

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
    readonly entryKinds?: readonly ('trade' | 'deposit' | 'withdrawal')[] | null;
    readonly instrumentIds: readonly string[] | null;
    readonly netResultBounds?: {
      readonly maximum: string | null;
      readonly minimum: string | null;
    } | null;
    readonly resultKinds: readonly TradeResultKind[] | null;
    readonly resultUnits?: readonly TradeResultKind[] | null;
    readonly textQuery?: string | null;
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

type SummaryFilters = NonNullable<TradeSummaryQuery['filters']>;

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

const matchesSummaryFilters = (trade: TradeSummaryFact, filters: SummaryFilters): boolean => {
  if (filters.instrumentIds !== null && !filters.instrumentIds.includes(trade.instrumentId)) {
    return false;
  }
  if (filters.resultKinds !== null && !filters.resultKinds.includes(trade.resultKind)) {
    return false;
  }
  if (filters.resultUnits != null) {
    const unit = trade.inputResultKind ?? trade.resultKind;
    if (!filters.resultUnits.includes(unit)) return false;
  }
  if (filters.entryKinds != null && !filters.entryKinds.includes('trade')) return false;
  if (filters.textQuery != null && filters.textQuery !== '') {
    if (!trade.id.toUpperCase().includes(filters.textQuery.toUpperCase())) return false;
  }
  if (filters.netResultBounds != null) {
    const { minimum, maximum } = filters.netResultBounds;
    if (minimum !== null || maximum !== null) {
      const value = getTradeMetricValue(trade, TRADE_RESULT_KINDS.cash);
      if (value === null) return false;
      if (minimum !== null && maximum !== null && minimum === maximum) {
        if (!value.equals(new Decimal(minimum))) return false;
      } else {
        if (minimum !== null && value.lessThan(new Decimal(minimum))) return false;
        if (maximum !== null && value.greaterThan(new Decimal(maximum))) return false;
      }
    }
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
};

/**
 * Builds a trade summary from a single streaming pass. Only running counters,
 * one Decimal total and a per-instrument map are retained, so the journal size
 * does not determine the memory held by a summary.
 */
export const summarizeTradeFacts = (
  facts: Iterable<TradeSummaryFact>,
  query: TradeSummaryQuery,
): TradeSummary => {
  const start = startOfPeriod(query.period, query.now);
  const startTime = start === null ? null : start.getTime();
  const filters = query.filters ?? null;

  let totalTrades = 0;
  let coveredTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let neutralTrades = 0;
  let total = new Decimal(0);
  const byInstrument = new Map<string, { symbol: string; total: Decimal }>();

  for (const trade of facts) {
    if (startTime !== null && new Date(trade.closedAt).getTime() < startTime) continue;
    if (filters !== null && !matchesSummaryFilters(trade, filters)) continue;
    totalTrades += 1;
    const value = getTradeMetricValue(trade, query.metric);
    const tone = classifyTradeResult(trade, query);
    if (value === null || tone === null) continue;
    coveredTrades += 1;
    total = total.plus(value);
    if (tone === TRADE_RESULT_TONES.positive) winningTrades += 1;
    else if (tone === TRADE_RESULT_TONES.negative) losingTrades += 1;
    else neutralTrades += 1;
    const previous = byInstrument.get(trade.instrumentId);
    byInstrument.set(trade.instrumentId, {
      symbol: trade.instrumentSymbol,
      total: (previous?.total ?? new Decimal(0)).plus(value),
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
  const decided = winningTrades + losingTrades;

  return {
    bestInstrument,
    coveredTrades,
    losingTrades,
    neutralTrades,
    totalResult: coveredTrades === 0 ? null : total.toString(),
    totalTrades,
    winRate: decided === 0 ? null : new Decimal(winningTrades).div(decided).mul(100).toString(),
    winningTrades,
    worstInstrument,
  };
};

export const calculateTradeSummary = (
  trades: readonly ClosedTrade[],
  query: TradeSummaryQuery,
): TradeSummary => summarizeTradeFacts(trades, query);
