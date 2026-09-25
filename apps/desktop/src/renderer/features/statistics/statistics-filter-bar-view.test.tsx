import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_APPLICATION_SETTINGS } from '../../../shared/application-settings';
import { i18n } from '../../i18n';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { StatisticsFilterBarView } from './statistics-filter-bar-view';
import type { StatisticsPresenter } from './use-statistics-presenter';

const createPresenter = (overrides: Partial<StatisticsPresenter> = {}): StatisticsPresenter => ({
  accountIds: [],
  categories: [],
  customFrom: '',
  customTo: '',
  directions: [],
  hasActiveFilters: false,
  instrumentIds: [],
  loading: false,
  period: 'all',
  refreshing: false,
  report: null,
  view: DEFAULT_APPLICATION_SETTINGS.statisticsView,
  resetFilters: vi.fn(),
  setAccountIds: vi.fn(),
  setBreakdownDimension: vi.fn(),
  setBreakdownMetric: vi.fn(),
  setCategories: vi.fn(),
  setChartMetric: vi.fn(),
  setChartType: vi.fn(),
  setCustomRange: vi.fn(),
  setDirections: vi.fn(),
  setInstrumentIds: vi.fn(),
  setPeriod: vi.fn(),
  setTimeGrain: vi.fn(),
  ...overrides,
});

const renderFilterBar = (presenter: StatisticsPresenter): void => {
  render(
    <I18nextProvider i18n={i18n}>
      <StatisticsFilterBarView
        accounts={[]}
        categoryOptions={[]}
        instruments={[]}
        presenter={presenter}
      />
    </I18nextProvider>,
  );
};

describe('StatisticsFilterBarView compact controls', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru');
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the period select on the shared compact height like the multi-select filters', () => {
    renderFilterBar(createPresenter());

    const period = screen.getByRole('combobox', {
      name: i18n.t(TRANSLATION_KEYS.statisticsPeriod),
    });
    const accountFilter = screen.getByRole('button', {
      name: i18n.t(TRANSLATION_KEYS.statisticsAccounts),
    });

    expect(period).toHaveClass('ui-select-trigger', 'ui-control-compact');
    expect(accountFilter).toHaveClass('ui-filter-trigger');
  });

  it('applies the compact height to the reset action as well', () => {
    renderFilterBar(createPresenter({ hasActiveFilters: true }));

    expect(screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionReset) })).toHaveClass(
      'ui-icon-button',
      'ui-control-compact',
    );
  });
});
