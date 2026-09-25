import { useEffect, useRef, useState } from 'react';

import type {
  AnalyticsBreakdownDimension,
  AnalyticsBreakdownMetric,
  AnalyticsReportDto,
  AnalyticsReportRequestDto,
  AnalyticsTimeGrain,
  ApplicationSettingsDto,
  InstrumentCategory,
  StatisticsChartMetric,
  StatisticsChartType,
  TradeDirection,
} from '../../../shared/desktop-api';
import { DEFAULT_APPLICATION_SETTINGS } from '../../../shared/application-settings';

export type StatisticsPeriodPreset =
  'all' | 'current-day' | 'current-week' | 'current-month' | 'current-year' | 'custom';

interface StatisticsDependencies {
  readonly dataVersion: number;
  readonly enabled: boolean;
  readonly getReport: (input: AnalyticsReportRequestDto) => Promise<AnalyticsReportDto | null>;
  readonly settings: ApplicationSettingsDto;
  readonly updateSettings: (settings: ApplicationSettingsDto) => Promise<void>;
}

export interface StatisticsPresenter {
  readonly accountIds: readonly string[];
  readonly categories: readonly InstrumentCategory[];
  readonly customFrom: string;
  readonly customTo: string;
  readonly directions: readonly TradeDirection[];
  readonly hasActiveFilters: boolean;
  readonly instrumentIds: readonly string[];
  readonly loading: boolean;
  readonly period: StatisticsPeriodPreset;
  readonly refreshing: boolean;
  readonly report: AnalyticsReportDto | null;
  readonly view: ApplicationSettingsDto['statisticsView'];
  resetFilters(): void;
  setAccountIds(value: readonly string[]): void;
  setBreakdownDimension(value: AnalyticsBreakdownDimension): void;
  setBreakdownMetric(value: AnalyticsBreakdownMetric): void;
  setCategories(value: readonly InstrumentCategory[]): void;
  setChartMetric(value: StatisticsChartMetric): void;
  setChartType(value: StatisticsChartType): void;
  setCustomRange(value: { readonly from: string; readonly to: string }): void;
  setDirections(value: readonly TradeDirection[]): void;
  setInstrumentIds(value: readonly string[]): void;
  setPeriod(value: StatisticsPeriodPreset): void;
  setTimeGrain(value: AnalyticsTimeGrain): void;
}

export const resolveStatisticsRange = (
  period: StatisticsPeriodPreset,
  custom: { readonly from: string; readonly to: string },
  now = new Date(),
): AnalyticsReportRequestDto['range'] | null => {
  if (period === 'all') return { fromInclusive: null, toExclusive: null };
  if (period === 'custom') {
    if (custom.from === '' || custom.to === '') return null;
    const end = new Date(`${custom.to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    return { fromInclusive: `${custom.from}T00:00:00.000Z`, toExclusive: end.toISOString() };
  }
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === 'current-week') {
    const mondayOffset = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - mondayOffset);
  } else if (period === 'current-month') start.setUTCDate(1);
  else if (period === 'current-year') start.setUTCMonth(0, 1);
  return { fromInclusive: start.toISOString(), toExclusive: end.toISOString() };
};

export const useStatisticsPresenter = ({
  dataVersion,
  enabled,
  getReport,
  settings,
  updateSettings,
}: StatisticsDependencies): StatisticsPresenter => {
  const [period, setPeriod] = useState<StatisticsPeriodPreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [accountIds, setAccountIds] = useState<readonly string[]>([]);
  const [instrumentIds, setInstrumentIds] = useState<readonly string[]>([]);
  const [categories, setCategories] = useState<readonly InstrumentCategory[]>([]);
  const [directions, setDirections] = useState<readonly TradeDirection[]>([]);
  const [report, setReport] = useState<AnalyticsReportDto | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestSequence = useRef(0);
  const view = settings.statisticsView ?? DEFAULT_APPLICATION_SETTINGS.statisticsView;

  useEffect(() => {
    if (!enabled) {
      setRefreshing(false);
      return;
    }
    const range = resolveStatisticsRange(period, { from: customFrom, to: customTo });
    if (range === null) {
      setRefreshing(false);
      return;
    }
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    let active = true;
    setRefreshing(true);
    void getReport({
      breakdown: {
        dimension: view.breakdownDimension,
        limit: 50,
        metric: view.breakdownMetric,
      },
      filters: {
        accountIds,
        categories,
        directions,
        includeUnassigned: false,
        instrumentIds,
      },
      range,
      timeGrain: view.timeGrain,
    }).then((nextReport) => {
      if (!active || requestSequence.current !== sequence) return;
      if (nextReport !== null) setReport(nextReport);
      setRefreshing(false);
    });
    return () => {
      active = false;
    };
  }, [
    accountIds,
    categories,
    customFrom,
    customTo,
    dataVersion,
    directions,
    enabled,
    getReport,
    instrumentIds,
    period,
    view.breakdownDimension,
    view.breakdownMetric,
    view.timeGrain,
  ]);

  const updateView = (next: ApplicationSettingsDto['statisticsView']): void => {
    void updateSettings({ ...settings, statisticsView: next });
  };

  const hasActiveFilters =
    period !== 'all' ||
    customFrom !== '' ||
    customTo !== '' ||
    accountIds.length > 0 ||
    instrumentIds.length > 0 ||
    categories.length > 0 ||
    directions.length > 0;

  return {
    accountIds,
    categories,
    customFrom,
    customTo,
    directions,
    hasActiveFilters,
    instrumentIds,
    loading: report === null && refreshing,
    period,
    refreshing,
    report,
    resetFilters: () => {
      setAccountIds([]);
      setInstrumentIds([]);
      setCategories([]);
      setDirections([]);
      setCustomFrom('');
      setCustomTo('');
      setPeriod('all');
    },
    setAccountIds,
    setBreakdownDimension: (value) => updateView({ ...view, breakdownDimension: value }),
    setBreakdownMetric: (value) => updateView({ ...view, breakdownMetric: value }),
    setCategories,
    setChartMetric: (value) => updateView({ ...view, chartMetric: value }),
    setChartType: (value) => updateView({ ...view, chartType: value }),
    setCustomRange: ({ from, to }) => {
      setCustomFrom(from);
      setCustomTo(to);
    },
    setDirections,
    setInstrumentIds,
    setPeriod,
    setTimeGrain: (value) => updateView({ ...view, timeGrain: value }),
    view,
  };
};
