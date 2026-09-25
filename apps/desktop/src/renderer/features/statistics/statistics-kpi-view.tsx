import {
  Activity,
  Hash,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import type { AnalyticsReportDto } from '../../../shared/desktop-api';
import { formatDecimalString } from '../../components/format-decimal';
import { TRANSLATION_KEYS } from '../../i18n-keys';

interface StatisticsKpiViewProps {
  readonly report: AnalyticsReportDto;
}

type KpiTone = 'accent' | 'negative' | 'neutral' | 'positive';

interface KpiItem {
  readonly Icon: LucideIcon;
  readonly label: string;
  /** Exact percentage rendered as a compact meter next to the value. */
  readonly meter?: number;
  readonly tone: KpiTone;
  readonly value: string;
}

const clampPercent = (value: number): number =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

/** Sign of a Decimal string drives the financial tone; absent data stays neutral. */
const signTone = (raw: string | null): KpiTone => {
  if (raw === null) return 'neutral';
  if (raw.trim().startsWith('-')) return 'negative';
  return Number(raw) === 0 ? 'neutral' : 'positive';
};

const magnitudeTone = (raw: string | null): KpiTone => {
  if (raw === null) return 'neutral';
  return Number(raw) === 0 ? 'neutral' : 'negative';
};

export const StatisticsKpiView = ({ report }: StatisticsKpiViewProps): ReactElement => {
  const { i18n, t } = useTranslation();
  const value = (raw: string | null, suffix = ''): string =>
    raw === null ? '—' : `${formatDecimalString(raw, i18n.language)}${suffix}`;
  const items: readonly KpiItem[] = [
    {
      Icon: TrendingUp,
      label: t(TRANSLATION_KEYS.statisticsTotalResult),
      tone: signTone(report.kpis.netResultUsd),
      value: value(report.kpis.netResultUsd, ' USD'),
    },
    {
      Icon: Target,
      label: t(TRANSLATION_KEYS.statisticsWinRate),
      meter: report.kpis.winRatePercent === null ? undefined : Number(report.kpis.winRatePercent),
      tone: 'accent',
      value: value(report.kpis.winRatePercent, '%'),
    },
    {
      Icon: TrendingDown,
      label: t(TRANSLATION_KEYS.statisticsMaxDrawdown),
      tone: magnitudeTone(report.kpis.maxDrawdownUsd),
      value: value(report.kpis.maxDrawdownUsd, ' USD'),
    },
    {
      Icon: Scale,
      label: t(TRANSLATION_KEYS.statisticsProfitFactor),
      tone: 'neutral',
      value: value(report.kpis.profitFactor),
    },
    {
      Icon: Hash,
      label: t(TRANSLATION_KEYS.statisticsTotalTrades),
      tone: 'neutral',
      value: String(report.coverage.coveredTrades),
    },
    {
      Icon: Activity,
      label: t(TRANSLATION_KEYS.statisticsAverageTrade),
      tone: signTone(report.kpis.averageTradeUsd),
      value: value(report.kpis.averageTradeUsd, ' USD'),
    },
  ];
  return (
    <div className="statistics-kpis">
      {items.map(({ Icon, label, meter, tone, value: metricValue }) => (
        <div
          aria-label={`${label}: ${metricValue}`}
          className={`statistics-kpi statistics-kpi-${tone}`}
          key={label}
          role="group"
        >
          <span className="statistics-kpi-label">
            <Icon aria-hidden="true" className="statistics-kpi-icon" size={14} />
            <span className="statistics-kpi-label-text">{label}</span>
          </span>
          <strong className="ui-numeric">{metricValue}</strong>
          {meter !== undefined && (
            <span aria-hidden="true" className="ui-meter statistics-kpi-meter">
              <span
                className="ui-meter-fill"
                data-tone="accent"
                style={{ width: `${clampPercent(meter)}%` }}
              />
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
