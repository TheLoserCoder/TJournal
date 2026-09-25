/**
 * Browser-safe public entry point for Statistics presentation contracts.
 * Only types and named constants are exported, so the renderer never pulls the
 * analytics application layer or SQLite adapters into its bundle.
 */
export {
  ANALYTICS_BREAKDOWN_DIMENSIONS,
  ANALYTICS_BREAKDOWN_METRICS,
  ANALYTICS_TIME_GRAINS,
  MAX_ANALYTICS_BREAKDOWN_ROWS,
  MAX_ANALYTICS_FILTER_VALUES,
  MAX_ANALYTICS_SERIES_POINTS,
  UNASSIGNED_ACCOUNT_ID,
  type AnalyticsBreakdownDimension,
  type AnalyticsBreakdownMetric,
  type AnalyticsBreakdownRow,
  type AnalyticsReport,
  type AnalyticsReportFilters,
  type AnalyticsReportQuery,
  type AnalyticsReportRange,
  type AnalyticsReportRequest,
  type AnalyticsSeriesPoint,
  type AnalyticsTimeGrain,
  type EffectiveAnalyticsTimeGrain,
} from './domain/analytics-report';
