import type { InstrumentCategory } from '@tjournal/instrument';
import type { NeutralRange, TradeDirection } from '@tjournal/trade';

export const ANALYTICS_TIME_GRAINS = {
  auto: 'auto',
  day: 'day',
  hour: 'hour',
  month: 'month',
  week: 'week',
} as const;
export type AnalyticsTimeGrain = (typeof ANALYTICS_TIME_GRAINS)[keyof typeof ANALYTICS_TIME_GRAINS];
export type EffectiveAnalyticsTimeGrain = Exclude<AnalyticsTimeGrain, 'auto'> | 'year';

export const ANALYTICS_BREAKDOWN_DIMENSIONS = {
  account: 'account',
  category: 'category',
  instrument: 'instrument',
} as const;
export type AnalyticsBreakdownDimension =
  (typeof ANALYTICS_BREAKDOWN_DIMENSIONS)[keyof typeof ANALYTICS_BREAKDOWN_DIMENSIONS];

export const ANALYTICS_BREAKDOWN_METRICS = {
  netResult: 'net-result',
  tradeCount: 'trade-count',
  winRate: 'win-rate',
} as const;
export type AnalyticsBreakdownMetric =
  (typeof ANALYTICS_BREAKDOWN_METRICS)[keyof typeof ANALYTICS_BREAKDOWN_METRICS];

export const MAX_ANALYTICS_BREAKDOWN_ROWS = 50;
export const MAX_ANALYTICS_FILTER_VALUES = 500;
export const MAX_ANALYTICS_SERIES_POINTS = 400;
export const UNASSIGNED_ACCOUNT_ID = '__unassigned__';

export interface AnalyticsReportFilters {
  readonly accountIds: readonly string[];
  readonly categories: readonly InstrumentCategory[];
  readonly directions: readonly TradeDirection[];
  readonly includeUnassigned: boolean;
  readonly instrumentIds: readonly string[];
}

export interface AnalyticsReportRange {
  readonly fromInclusive: string | null;
  readonly toExclusive: string | null;
}

export interface AnalyticsReportRequest {
  readonly breakdown: {
    readonly dimension: AnalyticsBreakdownDimension;
    readonly limit: number;
    readonly metric: AnalyticsBreakdownMetric;
  };
  readonly filters: AnalyticsReportFilters;
  readonly range: AnalyticsReportRange;
  readonly timeGrain: AnalyticsTimeGrain;
}

export interface AnalyticsReportQuery extends AnalyticsReportRequest {
  readonly neutralRange: NeutralRange | null;
}

export interface AnalyticsBreakdownRow {
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

export interface AnalyticsSeriesPoint {
  readonly bucketEnd: string;
  readonly bucketStart: string;
  readonly coveredTrades: number;
  readonly cumulativeNetResultUsd: string;
  readonly drawdownUsd: string;
  readonly netResultUsd: string;
}

export interface AnalyticsReport {
  readonly breakdown: {
    readonly dimension: AnalyticsBreakdownDimension;
    readonly metric: AnalyticsBreakdownMetric;
    readonly omittedGroupCount: number;
    readonly rows: readonly AnalyticsBreakdownRow[];
    readonly totalGroupCount: number;
  };
  readonly coverage: {
    readonly coveredTrades: number;
    readonly excludedTrades: number;
    readonly totalTrades: number;
  };
  readonly effectiveRange: AnalyticsReportRange & {
    readonly grain: EffectiveAnalyticsTimeGrain;
  };
  readonly highlights: {
    readonly bestInstrument: AnalyticsBreakdownRow | null;
    readonly worstInstrument: AnalyticsBreakdownRow | null;
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
  readonly series: readonly AnalyticsSeriesPoint[];
}
