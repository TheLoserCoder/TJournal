import type { ReactElement } from 'react';
import { Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { TRANSLATION_KEYS } from '../../i18n-keys';
import { IconButton } from '../../components/ui/icon-button';
import { Tooltip } from '../../components/ui/tooltip';
import type { TradeSummaryPresenter } from './use-trade-summary-presenter';
import { formatDecimalString } from './format-decimal';

type SummaryTone = 'accent' | 'negative' | 'neutral' | 'positive' | 'total';
type SummaryEmphasis = 'hero' | 'supporting';

interface SummaryMetric {
  readonly emphasis: SummaryEmphasis;
  readonly label: string;
  readonly marker?: string;
  readonly suffix?: string;
  readonly tone: SummaryTone;
  readonly tooltip?: string;
  readonly value: string;
}

const renderMetric = (metric: SummaryMetric, translate: (key: string) => string): ReactElement => {
  const value = (
    <strong>
      {metric.marker !== undefined && (
        <span aria-hidden="true" className="trade-summary-marker">
          {metric.marker}
        </span>
      )}
      {metric.value}
      {metric.suffix !== undefined && (
        <span aria-hidden="true" className="trade-summary-suffix">
          {metric.suffix}
        </span>
      )}
    </strong>
  );

  return (
    <div
      aria-label={`${translate(metric.label)}: ${metric.value}`}
      className={`trade-summary-item trade-summary-item-${metric.tone}`}
      data-emphasis={metric.emphasis}
      key={metric.label}
      role="group"
    >
      <span className="trade-summary-label">{translate(metric.label)}</span>
      {metric.tooltip === undefined ? value : <Tooltip content={metric.tooltip}>{value}</Tooltip>}
    </div>
  );
};

const renderGroup = (
  className: string,
  label: string,
  metrics: readonly SummaryMetric[],
  translate: (key: string) => string,
): ReactElement => (
  <div aria-label={label} className={`trade-summary-group ${className}`} role="group">
    {metrics.map((metric) => renderMetric(metric, translate))}
  </div>
);

export const TradeSummaryView = ({
  presenter,
}: {
  readonly presenter: TradeSummaryPresenter;
}): ReactElement | null => {
  const { i18n, t } = useTranslation();
  const summary = presenter.summary;
  if (summary === null) return null;
  const language = i18n.language === 'en' ? 'en' : 'ru';
  const financialMetrics: readonly SummaryMetric[] = [
    {
      emphasis: 'hero',
      label: TRANSLATION_KEYS.statisticsTotalResult,
      marker: '$',
      tone:
        summary.totalResult === null
          ? 'neutral'
          : summary.totalResult.startsWith('-')
            ? 'negative'
            : 'total',
      value:
        summary.totalResult === null ? '—' : formatDecimalString(summary.totalResult, language),
    },
    {
      emphasis: 'supporting',
      label: TRANSLATION_KEYS.statisticsAccountedBalance,
      marker: '$',
      tone: 'accent',
      value:
        summary.accountedBalanceUsd === undefined
          ? '—'
          : formatDecimalString(summary.accountedBalanceUsd, language),
    },
  ];
  const performanceMetrics: readonly SummaryMetric[] = [
    {
      emphasis: 'hero',
      label: TRANSLATION_KEYS.statisticsWinRate,
      suffix: '%',
      tone: 'accent',
      value: summary.winRate === null ? '—' : formatDecimalString(summary.winRate, language),
    },
    {
      emphasis: 'supporting',
      label: TRANSLATION_KEYS.statisticsTotalTrades,
      marker: '#',
      tone: 'neutral',
      value: String(summary.totalTrades),
    },
    {
      emphasis: 'supporting',
      label: TRANSLATION_KEYS.statisticsWins,
      marker: '#',
      tone: 'positive',
      value: String(summary.winningTrades ?? '—'),
    },
    {
      emphasis: 'supporting',
      label: TRANSLATION_KEYS.statisticsLosses,
      marker: '#',
      tone: 'negative',
      value: String(summary.losingTrades ?? '—'),
    },
    {
      emphasis: 'supporting',
      label: TRANSLATION_KEYS.statisticsNeutral,
      marker: '#',
      tone: 'neutral',
      value: String(summary.neutralTrades ?? '—'),
    },
  ];
  const assetMetrics: readonly SummaryMetric[] = [
    {
      emphasis: 'supporting',
      label: TRANSLATION_KEYS.statisticsBestAsset,
      tone: 'neutral',
      tooltip: summary.bestInstrument ?? undefined,
      value: summary.bestInstrument ?? '—',
    },
    {
      emphasis: 'supporting',
      label: TRANSLATION_KEYS.statisticsWorstAsset,
      tone: 'neutral',
      tooltip: summary.worstInstrument ?? undefined,
      value: summary.worstInstrument ?? '—',
    },
  ];

  return (
    <div
      aria-busy={presenter.summaryRefreshing}
      aria-live="polite"
      className="trade-summary"
      data-refreshing={presenter.summaryRefreshing ? 'true' : 'false'}
    >
      {renderGroup(
        'trade-summary-group-financial',
        t(TRANSLATION_KEYS.statisticsFinancials),
        financialMetrics,
        t,
      )}
      {renderGroup(
        'trade-summary-group-performance',
        t(TRANSLATION_KEYS.statisticsPerformance),
        performanceMetrics,
        t,
      )}
      {renderGroup(
        'trade-summary-group-assets',
        t(TRANSLATION_KEYS.statisticsAssets),
        assetMetrics,
        t,
      )}
      <div className="trade-summary-settings">
        <Tooltip content={t(TRANSLATION_KEYS.statisticsSettings)}>
          <IconButton
            label={t(TRANSLATION_KEYS.statisticsSettings)}
            onClick={presenter.openSettings}
          >
            <Settings2 aria-hidden="true" />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
};
