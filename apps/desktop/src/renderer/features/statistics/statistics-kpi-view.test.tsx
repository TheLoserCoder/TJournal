import { cleanup, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AnalyticsReportDto } from '../../../shared/desktop-api';
import { i18n } from '../../i18n';
import { StatisticsKpiView } from './statistics-kpi-view';

const report = (winRatePercent: string | null): AnalyticsReportDto => ({
  breakdown: {
    dimension: 'instrument',
    metric: 'net-result',
    omittedGroupCount: 0,
    rows: [],
    totalGroupCount: 0,
  },
  coverage: { coveredTrades: 3, excludedTrades: 0, totalTrades: 3 },
  effectiveRange: { fromInclusive: null, grain: 'day', toExclusive: null },
  highlights: { bestInstrument: null, worstInstrument: null },
  kpis: {
    averageTradeUsd: '10',
    grossLossMagnitudeUsd: '0',
    grossProfitUsd: '30',
    losingTrades: 0,
    maxDrawdownUsd: '0',
    netResultUsd: '30',
    neutralTrades: 0,
    profitFactor: null,
    winRatePercent,
    winningTrades: 3,
  },
  series: [],
});

const renderKpis = (winRatePercent: string | null): void => {
  render(
    <I18nextProvider i18n={i18n}>
      <StatisticsKpiView report={report(winRatePercent)} />
    </I18nextProvider>,
  );
};

describe('StatisticsKpiView win-rate ring', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the same compact win-rate donut as the trades summary', () => {
    renderKpis('75');

    expect(document.querySelector('.ui-win-rate-ring')).not.toBeNull();
  });

  it('omits the donut when the win rate is unavailable', () => {
    renderKpis(null);

    expect(document.querySelector('.ui-win-rate-ring')).toBeNull();
  });
});
