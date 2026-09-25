import { I18nextProvider } from 'react-i18next';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../i18n';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { formatDecimalString } from './format-decimal';
import type { TradeSummaryPresenter } from './use-trade-summary-presenter';
import { TradeSummaryView } from './trade-summary-view';

const createPresenter = (
  overrides: Partial<TradeSummaryPresenter> = {},
): TradeSummaryPresenter => ({
  closeSettings: vi.fn(),
  followTableFilters: false,
  metric: 'cash',
  openSettings: vi.fn(),
  period: 'all',
  setFollowTableFilters: vi.fn(),
  setMetric: vi.fn(),
  setPeriod: vi.fn(),
  settingsOpen: false,
  summary: {
    accountedBalanceUsd: '3200',
    bestInstrument: 'EURUSD',
    coveredTrades: 3,
    losingTrades: 0,
    neutralTrades: 0,
    totalResult: '400',
    totalTrades: 3,
    winRate: '100',
    winningTrades: 3,
    worstInstrument: null,
  },
  summaryRefreshing: false,
  ...overrides,
});

const renderSummary = (presenter: TradeSummaryPresenter): void => {
  render(
    <I18nextProvider i18n={i18n}>
      <TradeSummaryView presenter={presenter} />
    </I18nextProvider>,
  );
};

describe('TradeSummaryView', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    await i18n.changeLanguage('ru');
  });

  it('renders the compact groups in the intended reading order', () => {
    renderSummary(createPresenter());

    const financials = screen.getByRole('group', {
      name: i18n.t(TRANSLATION_KEYS.statisticsFinancials),
    });
    const performance = screen.getByRole('group', {
      name: i18n.t(TRANSLATION_KEYS.statisticsPerformance),
    });
    const assets = screen.getByRole('group', {
      name: i18n.t(TRANSLATION_KEYS.statisticsAssets),
    });

    expect(
      within(financials)
        .getAllByRole('group')
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual([
      `${i18n.t(TRANSLATION_KEYS.statisticsTotalResult)}: 400`,
      `${i18n.t(TRANSLATION_KEYS.statisticsAccountedBalance)}: ${formatDecimalString('3200', 'ru')}`,
    ]);
    expect(
      within(performance)
        .getAllByRole('group')
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual([
      `${i18n.t(TRANSLATION_KEYS.statisticsWinRate)}: 100`,
      `${i18n.t(TRANSLATION_KEYS.statisticsTotalTrades)}: 3`,
      `${i18n.t(TRANSLATION_KEYS.statisticsWins)}: 3`,
      `${i18n.t(TRANSLATION_KEYS.statisticsLosses)}: 0`,
      `${i18n.t(TRANSLATION_KEYS.statisticsNeutral)}: 0`,
    ]);
    expect(
      within(assets)
        .getAllByRole('group')
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual([
      `${i18n.t(TRANSLATION_KEYS.statisticsBestAsset)}: EURUSD`,
      `${i18n.t(TRANSLATION_KEYS.statisticsWorstAsset)}: —`,
    ]);
    expect(
      screen
        .getByRole('group', { name: `${i18n.t(TRANSLATION_KEYS.statisticsTotalResult)}: 400` })
        .querySelector('strong'),
    ).toHaveTextContent('$400');
    expect(
      screen
        .getByRole('group', { name: `${i18n.t(TRANSLATION_KEYS.statisticsWinRate)}: 100` })
        .querySelector('strong'),
    ).toHaveTextContent('100%');
  });

  it('renders the win rate as an exact value with a decorative donut', () => {
    renderSummary(createPresenter());

    const winRate = screen.getByRole('group', {
      name: `${i18n.t(TRANSLATION_KEYS.statisticsWinRate)}: 100`,
    });
    const ring = winRate.querySelector('.ui-win-rate-ring');

    expect(winRate.querySelector('strong')).toHaveTextContent('100%');
    expect(ring).not.toBeNull();
    expect(ring).toHaveAttribute('aria-hidden', 'true');
    expect(ring?.getAttribute('style')).toContain('100%');
  });

  it('omits the donut when the win rate is unavailable', () => {
    renderSummary(
      createPresenter({
        summary: {
          accountedBalanceUsd: undefined,
          bestInstrument: null,
          coveredTrades: 0,
          losingTrades: 0,
          neutralTrades: 0,
          totalResult: null,
          totalTrades: 0,
          winRate: null,
          winningTrades: 0,
          worstInstrument: null,
        },
      }),
    );

    expect(document.querySelector('.ui-win-rate-ring')).toBeNull();
  });

  it('preserves negative, unavailable and refreshing states', () => {
    const presenter = createPresenter({
      summaryRefreshing: true,
      summary: {
        accountedBalanceUsd: undefined,
        bestInstrument: null,
        coveredTrades: 0,
        losingTrades: null,
        neutralTrades: null,
        totalResult: '-12.5',
        totalTrades: 0,
        winRate: null,
        winningTrades: null,
        worstInstrument: 'A-VERY-LONG-INSTRUMENT-NAME',
      },
    });
    renderSummary(presenter);

    const summary = screen.getByRole('group', {
      name: i18n.t(TRANSLATION_KEYS.statisticsFinancials),
    }).parentElement;
    expect(summary).toHaveAttribute('aria-busy', 'true');
    expect(
      screen
        .getByRole('group', { name: `${i18n.t(TRANSLATION_KEYS.statisticsTotalResult)}: -12,5` })
        .querySelector('strong'),
    ).toHaveTextContent('$-12,5');
    expect(
      screen.getByRole('group', {
        name: `${i18n.t(TRANSLATION_KEYS.statisticsAccountedBalance)}: —`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', {
        name: `${i18n.t(TRANSLATION_KEYS.statisticsTotalResult)}: -12,5`,
      }).className,
    ).toContain('trade-summary-item-negative');
  });

  it('opens statistics settings from the reserved action area', () => {
    const presenter = createPresenter();
    renderSummary(presenter);

    screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.statisticsSettings) }).click();

    expect(presenter.openSettings).toHaveBeenCalledOnce();
  });
});
