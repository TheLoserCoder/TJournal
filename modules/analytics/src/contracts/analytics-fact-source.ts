import type { InstrumentCategory } from '@tjournal/instrument';
import type { TradeDirection } from '@tjournal/trade';

import type {
  AnalyticsBreakdownDimension,
  AnalyticsReportFilters,
  AnalyticsReportRange,
} from '../domain/analytics-report';

export interface AnalyticsTradeFact {
  readonly accountId: string | null;
  readonly accountLabel: string | null;
  readonly closedAt: string;
  readonly direction: TradeDirection | null;
  readonly id: string;
  readonly instrumentCategory: InstrumentCategory;
  readonly instrumentId: string;
  readonly instrumentLabel: string;
  readonly netResultUsd: string | null;
}

export interface AnalyticsFactQuery {
  readonly filters: AnalyticsReportFilters;
  readonly range: AnalyticsReportRange;
}

export interface AnalyticsFactSource {
  scanByDimension(
    query: AnalyticsFactQuery,
    dimension: AnalyticsBreakdownDimension,
  ): Iterable<AnalyticsTradeFact>;
  scanChronologically(query: AnalyticsFactQuery): Iterable<AnalyticsTradeFact>;
}
