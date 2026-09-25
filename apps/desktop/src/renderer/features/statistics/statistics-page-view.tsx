import { BarChart3, PieChart } from 'lucide-react';
import { lazy, Suspense, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { UNASSIGNED_ACCOUNT_ID } from '@tjournal/analytics/report-contracts';
import type {
  AccountDto,
  AnalyticsBreakdownRowDto,
  InstrumentCategory,
  InstrumentDto,
} from '../../../shared/desktop-api';
import { ResultDistributionRing } from '../../components/charts/result-distribution-ring';
import { formatDecimalString } from '../../components/format-decimal';
import { PageHeader } from '../../components/page-header';
import { Select } from '../../components/ui/select';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { StatisticsFilterBarView } from './statistics-filter-bar-view';
import { StatisticsKpiView } from './statistics-kpi-view';
import type { StatisticsPresenter } from './use-statistics-presenter';

const TimeSeriesChart = lazy(async () => ({
  default: (await import('../../components/charts/time-series-chart')).TimeSeriesChart,
}));
const BreakdownBarChart = lazy(async () => ({
  default: (await import('../../components/charts/breakdown-bar-chart')).BreakdownBarChart,
}));

interface StatisticsPageViewProps {
  readonly accounts: readonly AccountDto[];
  readonly instruments: readonly InstrumentDto[];
  readonly presenter: StatisticsPresenter;
}

const CATEGORY_KEYS: Readonly<Record<InstrumentCategory, string>> = {
  crypto: TRANSLATION_KEYS.statisticsCategoryCrypto,
  energy: TRANSLATION_KEYS.statisticsCategoryEnergy,
  equity: TRANSLATION_KEYS.statisticsCategoryEquity,
  etf: TRANSLATION_KEYS.statisticsCategoryEtf,
  forex: TRANSLATION_KEYS.statisticsCategoryForex,
  index: TRANSLATION_KEYS.statisticsCategoryIndex,
  metal: TRANSLATION_KEYS.statisticsCategoryMetal,
};

const isInstrumentCategory = (value: string): value is InstrumentCategory =>
  Object.hasOwn(CATEGORY_KEYS, value);

export const StatisticsPageView = ({
  accounts,
  instruments,
  presenter,
}: StatisticsPageViewProps): ReactElement => {
  const { i18n, t } = useTranslation();
  const categories = Object.entries(CATEGORY_KEYS).map(([id, key]) => ({ id, label: t(key) }));
  const report = presenter.report;
  const dimension = presenter.view.breakdownDimension;
  const localizeRow = (row: AnalyticsBreakdownRowDto): AnalyticsBreakdownRowDto => {
    const label =
      dimension === 'account' && row.id === UNASSIGNED_ACCOUNT_ID
        ? t(TRANSLATION_KEYS.accountUnassigned)
        : dimension === 'category' && isInstrumentCategory(row.id)
          ? t(CATEGORY_KEYS[row.id])
          : row.label;
    return { ...row, label };
  };
  const rows = report?.breakdown.rows.map(localizeRow) ?? [];
  const grainLabels = {
    day: t(TRANSLATION_KEYS.statisticsPeriodDay),
    hour: t(TRANSLATION_KEYS.statisticsPeriodHour),
    month: t(TRANSLATION_KEYS.statisticsPeriodMonth),
    week: t(TRANSLATION_KEYS.statisticsPeriodWeek),
    year: t(TRANSLATION_KEYS.statisticsPeriodYear),
  } as const;
  const format = (value: string | null, suffix = ''): string =>
    value === null ? '—' : `${formatDecimalString(value, i18n.language)}${suffix}`;
  const detailDateFormatter = new Intl.DateTimeFormat(
    i18n.language,
    report?.effectiveRange.grain === 'hour'
      ? { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short' }
      : { dateStyle: 'medium' },
  );

  return (
    <section aria-busy={presenter.refreshing} className="statistics-page">
      <PageHeader title={t(TRANSLATION_KEYS.navigationStatistics)} />
      <StatisticsFilterBarView
        accounts={accounts}
        categoryOptions={categories}
        instruments={instruments}
        presenter={presenter}
      />
      {presenter.loading && <p aria-live="polite">{t(TRANSLATION_KEYS.statisticsLoading)}</p>}
      {report !== null && report.coverage.excludedTrades > 0 && (
        <p className="statistics-coverage-warning" role="status">
          {t(TRANSLATION_KEYS.statisticsCoverageWarning, {
            covered: report.coverage.coveredTrades,
            total: report.coverage.totalTrades,
          })}
        </p>
      )}
      {report !== null && report.coverage.totalTrades === 0 && (
        <p className="ui-empty-state">{t(TRANSLATION_KEYS.statisticsEmpty)}</p>
      )}
      {report !== null && report.coverage.totalTrades > 0 && (
        <>
          <StatisticsKpiView report={report} />
          {report.coverage.coveredTrades > 0 && (
            <article className="statistics-card">
              <div className="statistics-card-header">
                <h2>
                  <BarChart3 aria-hidden="true" size={16} />
                  {t(TRANSLATION_KEYS.statisticsPerformance)}
                </h2>
                <div className="statistics-card-controls">
                  <Select
                    ariaLabel={t(TRANSLATION_KEYS.statisticsMetric)}
                    onValueChange={(value) =>
                      presenter.setChartMetric(value as StatisticsPresenter['view']['chartMetric'])
                    }
                    options={[
                      {
                        label: t(TRANSLATION_KEYS.statisticsChartMetricCumulative),
                        value: 'cumulative-net-result',
                      },
                      {
                        label: t(TRANSLATION_KEYS.statisticsChartMetricPeriod),
                        value: 'period-net-result',
                      },
                      {
                        label: t(TRANSLATION_KEYS.statisticsChartMetricDrawdown),
                        value: 'drawdown',
                      },
                    ]}
                    value={presenter.view.chartMetric}
                  />
                  <Select
                    ariaLabel={t(TRANSLATION_KEYS.statisticsChartType)}
                    onValueChange={(value) =>
                      presenter.setChartType(value as StatisticsPresenter['view']['chartType'])
                    }
                    options={[
                      { label: t(TRANSLATION_KEYS.statisticsChartLine), value: 'line' },
                      { label: t(TRANSLATION_KEYS.statisticsChartBar), value: 'bar' },
                    ]}
                    value={presenter.view.chartType}
                  />
                  <Select
                    ariaLabel={t(TRANSLATION_KEYS.statisticsTimeGrain)}
                    onValueChange={(value) =>
                      presenter.setTimeGrain(value as StatisticsPresenter['view']['timeGrain'])
                    }
                    options={[
                      { label: t(TRANSLATION_KEYS.statisticsTimeGrainAuto), value: 'auto' },
                      { label: t(TRANSLATION_KEYS.statisticsPeriodHour), value: 'hour' },
                      { label: t(TRANSLATION_KEYS.statisticsPeriodDay), value: 'day' },
                      { label: t(TRANSLATION_KEYS.statisticsPeriodWeek), value: 'week' },
                      { label: t(TRANSLATION_KEYS.statisticsPeriodMonth), value: 'month' },
                    ]}
                    value={presenter.view.timeGrain}
                  />
                </div>
              </div>
              <p className="statistics-effective-grain">
                {t(TRANSLATION_KEYS.statisticsEffectiveTimeGrain, {
                  grain: grainLabels[report.effectiveRange.grain],
                })}
              </p>
              <div className="statistics-performance-layout">
                <Suspense fallback={<p>{t(TRANSLATION_KEYS.statisticsLoading)}</p>}>
                  <TimeSeriesChart
                    chartType={presenter.view.chartType}
                    grain={report.effectiveRange.grain}
                    label={t(TRANSLATION_KEYS.statisticsPerformance)}
                    language={i18n.language}
                    metric={presenter.view.chartMetric}
                    points={report.series}
                  />
                </Suspense>
                <ResultDistributionRing
                  label={t(TRANSLATION_KEYS.statisticsPerformance)}
                  losingLabel={t(TRANSLATION_KEYS.statisticsLosses)}
                  losingTrades={report.kpis.losingTrades}
                  neutralLabel={t(TRANSLATION_KEYS.statisticsNeutral)}
                  neutralTrades={report.kpis.neutralTrades}
                  winRateLabel={t(TRANSLATION_KEYS.statisticsWinRate)}
                  winRateText={format(report.kpis.winRatePercent, '%')}
                  winningLabel={t(TRANSLATION_KEYS.statisticsWins)}
                  winningTrades={report.kpis.winningTrades}
                />
              </div>
              <details className="statistics-data-details">
                <summary>{t(TRANSLATION_KEYS.statisticsChartData)}</summary>
                <table>
                  <thead>
                    <tr>
                      <th>{t(TRANSLATION_KEYS.fieldDate)}</th>
                      <th>{t(TRANSLATION_KEYS.statisticsTotalResult)}</th>
                      <th>{t(TRANSLATION_KEYS.statisticsMaxDrawdown)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.series.map((point) => (
                      <tr key={point.bucketStart}>
                        <td>{detailDateFormatter.format(new Date(point.bucketStart))}</td>
                        <td>{format(point.cumulativeNetResultUsd, ' USD')}</td>
                        <td>{format(point.drawdownUsd, ' USD')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </article>
          )}
          {report.coverage.coveredTrades > 0 && (
            <article className="statistics-card">
              <div className="statistics-card-header">
                <h2>
                  <PieChart aria-hidden="true" size={16} />
                  {t(TRANSLATION_KEYS.statisticsBreakdown)}
                </h2>
                <div className="statistics-card-controls">
                  <Select
                    ariaLabel={t(TRANSLATION_KEYS.statisticsBreakdown)}
                    onValueChange={(value) =>
                      presenter.setBreakdownDimension(
                        value as StatisticsPresenter['view']['breakdownDimension'],
                      )
                    }
                    options={[
                      {
                        label: t(TRANSLATION_KEYS.statisticsBreakdownInstruments),
                        value: 'instrument',
                      },
                      { label: t(TRANSLATION_KEYS.statisticsBreakdownAccounts), value: 'account' },
                      {
                        label: t(TRANSLATION_KEYS.statisticsBreakdownCategories),
                        value: 'category',
                      },
                    ]}
                    value={presenter.view.breakdownDimension}
                  />
                  <Select
                    ariaLabel={t(TRANSLATION_KEYS.statisticsMetric)}
                    onValueChange={(value) =>
                      presenter.setBreakdownMetric(
                        value as StatisticsPresenter['view']['breakdownMetric'],
                      )
                    }
                    options={[
                      {
                        label: t(TRANSLATION_KEYS.statisticsBreakdownNetResult),
                        value: 'net-result',
                      },
                      { label: t(TRANSLATION_KEYS.statisticsBreakdownWinRate), value: 'win-rate' },
                      {
                        label: t(TRANSLATION_KEYS.statisticsBreakdownTradeCount),
                        value: 'trade-count',
                      },
                    ]}
                    value={presenter.view.breakdownMetric}
                  />
                </div>
              </div>
              <div className="statistics-highlights">
                <span className="statistics-highlight statistics-highlight-positive">
                  <span className="statistics-highlight-label">
                    {t(TRANSLATION_KEYS.statisticsBestAsset)}
                  </span>
                  <strong>{report.highlights.bestInstrument?.label ?? '—'}</strong>
                </span>
                <span className="statistics-highlight statistics-highlight-negative">
                  <span className="statistics-highlight-label">
                    {t(TRANSLATION_KEYS.statisticsWorstAsset)}
                  </span>
                  <strong>{report.highlights.worstInstrument?.label ?? '—'}</strong>
                </span>
              </div>
              <Suspense fallback={<p>{t(TRANSLATION_KEYS.statisticsLoading)}</p>}>
                <BreakdownBarChart
                  label={t(TRANSLATION_KEYS.statisticsBreakdown)}
                  language={i18n.language}
                  metric={presenter.view.breakdownMetric}
                  rows={rows}
                />
              </Suspense>
              <div
                aria-label={t(TRANSLATION_KEYS.statisticsBreakdown)}
                className="statistics-table-region"
                role="region"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th>{t(TRANSLATION_KEYS.statisticsName)}</th>
                      <th>{t(TRANSLATION_KEYS.statisticsTotalResult)}</th>
                      <th>{t(TRANSLATION_KEYS.statisticsWinRate)}</th>
                      <th>{t(TRANSLATION_KEYS.statisticsTotalTrades)}</th>
                      <th>{t(TRANSLATION_KEYS.statisticsMaxDrawdown)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.label}</td>
                        <td>{format(row.coveredTrades === 0 ? null : row.netResultUsd, ' USD')}</td>
                        <td>{format(row.winRatePercent, '%')}</td>
                        <td>{row.totalTrades}</td>
                        <td>{format(row.maxDrawdownUsd, ' USD')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {report.breakdown.omittedGroupCount > 0 && (
                <p>
                  {t(TRANSLATION_KEYS.statisticsOmittedGroups, {
                    count: report.breakdown.omittedGroupCount,
                  })}
                </p>
              )}
            </article>
          )}
        </>
      )}
    </section>
  );
};
