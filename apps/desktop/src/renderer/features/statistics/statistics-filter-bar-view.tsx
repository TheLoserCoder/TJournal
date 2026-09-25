import { RotateCcw } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import type { AccountDto, InstrumentDto } from '../../../shared/desktop-api';
import { DateRangePicker } from '../../components/ui/date-range-picker';
import { IconButton } from '../../components/ui/icon-button';
import { MultiSelect } from '../../components/ui/multi-select';
import { Select } from '../../components/ui/select';
import { Tooltip } from '../../components/ui/tooltip';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import type { StatisticsPresenter } from './use-statistics-presenter';

interface StatisticsFilterBarViewProps {
  readonly accounts: readonly AccountDto[];
  readonly categoryOptions: readonly { readonly id: string; readonly label: string }[];
  readonly instruments: readonly InstrumentDto[];
  readonly presenter: StatisticsPresenter;
}

export const StatisticsFilterBarView = ({
  accounts,
  categoryOptions,
  instruments,
  presenter,
}: StatisticsFilterBarViewProps): ReactElement => {
  const { t } = useTranslation();
  const empty = t(TRANSLATION_KEYS.statisticsNoOptions);
  const selectedSummary = (label: string, count: number): string =>
    count === 0 ? label : `${label}: ${count}`;
  return (
    <div
      aria-label={t(TRANSLATION_KEYS.statisticsFilters)}
      className="statistics-filter-bar"
      role="group"
    >
      <Select
        ariaLabel={t(TRANSLATION_KEYS.statisticsPeriod)}
        className="ui-control-compact"
        onValueChange={(value) => presenter.setPeriod(value as StatisticsPresenter['period'])}
        options={[
          { label: t(TRANSLATION_KEYS.statisticsPeriodAll), value: 'all' },
          { label: t(TRANSLATION_KEYS.statisticsPeriodDay), value: 'current-day' },
          { label: t(TRANSLATION_KEYS.statisticsPeriodWeek), value: 'current-week' },
          { label: t(TRANSLATION_KEYS.statisticsPeriodMonth), value: 'current-month' },
          { label: t(TRANSLATION_KEYS.statisticsPeriodYear), value: 'current-year' },
          { label: t(TRANSLATION_KEYS.statisticsPeriodCustom), value: 'custom' },
        ]}
        value={presenter.period}
      />
      {presenter.period === 'custom' && (
        <DateRangePicker
          from={presenter.customFrom}
          onChange={presenter.setCustomRange}
          summary={t(TRANSLATION_KEYS.tableDateRange)}
          to={presenter.customTo}
        />
      )}
      <MultiSelect
        emptyMessage={empty}
        onSelectedIdsChange={presenter.setAccountIds}
        options={accounts.map((account) => ({ id: account.id, label: account.name }))}
        placeholder={t(TRANSLATION_KEYS.statisticsAccounts)}
        searchLabel={t(TRANSLATION_KEYS.statisticsAccounts)}
        selectedIds={presenter.accountIds}
        summary={selectedSummary(
          t(TRANSLATION_KEYS.statisticsAccounts),
          presenter.accountIds.length,
        )}
      />
      <MultiSelect
        emptyMessage={empty}
        onSelectedIdsChange={presenter.setInstrumentIds}
        options={instruments.map((instrument) => ({ id: instrument.id, label: instrument.symbol }))}
        placeholder={t(TRANSLATION_KEYS.statisticsAssets)}
        searchLabel={t(TRANSLATION_KEYS.statisticsAssets)}
        selectedIds={presenter.instrumentIds}
        summary={selectedSummary(
          t(TRANSLATION_KEYS.statisticsAssets),
          presenter.instrumentIds.length,
        )}
      />
      <MultiSelect
        emptyMessage={empty}
        onSelectedIdsChange={(values) =>
          presenter.setCategories(values as StatisticsPresenter['categories'])
        }
        options={categoryOptions}
        placeholder={t(TRANSLATION_KEYS.statisticsCategories)}
        searchLabel={t(TRANSLATION_KEYS.statisticsCategories)}
        selectedIds={presenter.categories}
        summary={selectedSummary(
          t(TRANSLATION_KEYS.statisticsCategories),
          presenter.categories.length,
        )}
      />
      <MultiSelect
        emptyMessage={empty}
        onSelectedIdsChange={(values) =>
          presenter.setDirections(values as StatisticsPresenter['directions'])
        }
        options={[
          { id: 'long', label: t(TRANSLATION_KEYS.tradeDirectionLong) },
          { id: 'short', label: t(TRANSLATION_KEYS.tradeDirectionShort) },
        ]}
        placeholder={t(TRANSLATION_KEYS.statisticsDirections)}
        searchLabel={t(TRANSLATION_KEYS.statisticsDirections)}
        selectedIds={presenter.directions}
        summary={selectedSummary(
          t(TRANSLATION_KEYS.statisticsDirections),
          presenter.directions.length,
        )}
      />
      {presenter.hasActiveFilters && (
        <Tooltip content={t(TRANSLATION_KEYS.actionReset)}>
          <IconButton
            className="ui-control-compact"
            label={t(TRANSLATION_KEYS.actionReset)}
            onClick={presenter.resetFilters}
          >
            <RotateCcw aria-hidden="true" />
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
};
