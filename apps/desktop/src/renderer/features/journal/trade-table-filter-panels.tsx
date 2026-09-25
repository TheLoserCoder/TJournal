import type { ReactElement } from 'react';

import type { InstrumentCategory } from '../../../shared/desktop-api';
import { Checkbox } from '../../components/ui/checkbox';
import type { DataTableColumnFilterSchema } from '../../components/data-table-filter';
import { DateRangePickerPanel } from '../../components/ui/date-range-picker';
import { DateTimeRangePanel } from '../../components/ui/datetime-range-panel';
import { CheckboxListPanel, MultiSelectPanel } from '../../components/ui/multi-select';
import { NumberFilterPanel } from '../../components/ui/number-filter-panel';
import type { SelectOption } from '../../components/ui/select';
import { TextFilterPanel } from '../../components/ui/text-filter-panel';
import {
  TRADE_TAG_UNTAGGED_FILTER_ID,
  type TradeEntryFilter,
  type TradeResultUnitFilter,
} from './trade-table-filters';
import { TRADE_RESULT_FILTERS } from './trade-table.config';
import type { TradesTablePresenter } from './use-trades-table-presenter';

interface FilterPanelMessages {
  readonly accountUnassigned: string;
  readonly filterSearch: string;
  readonly noAssets: string;
  readonly noTags: string;
  readonly tagsUntagged: string;
}

export interface FilterPanelContext {
  readonly accountOptions: readonly { readonly id: string; readonly label: string }[];
  readonly assetCategoryOptions: readonly {
    readonly id: InstrumentCategory;
    readonly label: string;
  }[];
  readonly assetOptions: readonly { readonly id: string; readonly label: string }[];
  readonly columnLabel: (columnId: string) => string;
  readonly entryOptions: readonly { readonly label: string; readonly value: TradeEntryFilter }[];
  readonly messages: FilterPanelMessages;
  readonly presenter: TradesTablePresenter;
  readonly resultUnitLabel: string;
  readonly tagOptions: readonly { readonly id: string; readonly label: string }[];
  readonly unitOptions: readonly SelectOption[];
}

const renderTextPanel = (columnId: string, context: FilterPanelContext): ReactElement => (
  <TextFilterPanel
    label={context.columnLabel(columnId)}
    onChange={(state) => context.presenter.filters.setTextQuery(state.value)}
    state={{ value: context.presenter.filters.textQuery }}
  />
);

const renderNumberPanel = (columnId: string, context: FilterPanelContext): ReactElement => (
  <NumberFilterPanel
    label={context.columnLabel(columnId)}
    onChange={(state) => context.presenter.filters.setResultBounds(state)}
    state={context.presenter.filters.resultBounds}
    unit={context.resultUnitLabel}
  />
);

const renderAccountPanel = (context: FilterPanelContext): ReactElement => {
  const filters = context.presenter.filters;
  return (
    <div className="ui-checkbox-list">
      <MultiSelectPanel
        emptyMessage={context.messages.accountUnassigned}
        onSelectedIdsChange={(ids) => filters.setAccountFilterIds(ids)}
        options={context.accountOptions}
        placeholder={context.messages.filterSearch}
        searchLabel={context.columnLabel('account')}
        selectedIds={filters.accountFilterIds}
      />
      <label className="ui-filter-checkbox-row">
        <Checkbox
          ariaLabel={context.messages.accountUnassigned}
          checked={filters.accountIncludeUnassigned}
          onCheckedChange={filters.setAccountIncludeUnassigned}
        />
        <span>{context.messages.accountUnassigned}</span>
      </label>
    </div>
  );
};

const renderAssetPanel = (context: FilterPanelContext): ReactElement => (
  <MultiSelectPanel
    emptyMessage={context.messages.noAssets}
    onSelectedIdsChange={(ids) => context.presenter.filters.setAssetFilterIds(ids)}
    options={context.assetOptions}
    placeholder={context.messages.filterSearch}
    searchLabel={context.columnLabel('asset')}
    selectedIds={context.presenter.filters.assetFilterIds}
  />
);

const renderAssetCategoryPanel = (columnId: string, context: FilterPanelContext): ReactElement => (
  <CheckboxListPanel
    onSelectedIdsChange={(ids) =>
      context.presenter.filters.setAssetCategoryFilters(ids as readonly InstrumentCategory[])
    }
    options={context.assetCategoryOptions}
    searchLabel={context.columnLabel(columnId)}
    selectedIds={context.presenter.filters.assetCategoryFilters}
  />
);

const renderTagPanel = (columnId: string, context: FilterPanelContext): ReactElement => {
  const filters = context.presenter.filters;
  // "Without tags" is the first option of the same list, not a separate control.
  const options = [
    { id: TRADE_TAG_UNTAGGED_FILTER_ID, label: context.messages.tagsUntagged },
    ...context.tagOptions,
  ];
  const selectedIds = [
    ...(filters.tagIncludeUntagged ? [TRADE_TAG_UNTAGGED_FILTER_ID] : []),
    ...filters.tagFilterIds,
  ];
  return (
    <MultiSelectPanel
      emptyMessage={context.messages.noTags}
      onSelectedIdsChange={(ids) => {
        filters.setTagIncludeUntagged(ids.includes(TRADE_TAG_UNTAGGED_FILTER_ID));
        filters.setTagFilterIds(ids.filter((id) => id !== TRADE_TAG_UNTAGGED_FILTER_ID));
      }}
      options={options}
      placeholder={context.messages.filterSearch}
      searchLabel={context.columnLabel(columnId)}
      selectedIds={selectedIds}
    />
  );
};

const renderEntryTypePanel = (columnId: string, context: FilterPanelContext): ReactElement => (
  <CheckboxListPanel
    onSelectedIdsChange={(ids) =>
      context.presenter.filters.setEntryFilters(ids as readonly TradeEntryFilter[])
    }
    options={context.entryOptions.map((option) => ({ id: option.value, label: option.label }))}
    searchLabel={context.columnLabel(columnId)}
    selectedIds={context.presenter.filters.entryFilters}
  />
);

const renderResultUnitPanel = (columnId: string, context: FilterPanelContext): ReactElement => (
  <CheckboxListPanel
    onSelectedIdsChange={(ids) =>
      context.presenter.filters.setResultUnit(
        (ids[0] as TradeResultUnitFilter | undefined) ?? TRADE_RESULT_FILTERS.all,
      )
    }
    options={context.unitOptions.map((option) => ({ id: option.value, label: option.label }))}
    searchLabel={context.columnLabel(columnId)}
    selectedIds={
      context.presenter.filters.resultUnit === TRADE_RESULT_FILTERS.all
        ? []
        : [context.presenter.filters.resultUnit]
    }
  />
);

/**
 * Builds the editing surface for one table column from its declared filter
 * schema. Every value flows through the trades presenter, so panels never own
 * filtering rules.
 */
export const renderTradeFilterPanel = (
  columnId: string,
  schema: DataTableColumnFilterSchema,
  context: FilterPanelContext,
): ReactElement | null => {
  const filters = context.presenter.filters;
  switch (schema.kind) {
    case 'text':
      return renderTextPanel(columnId, context);
    case 'number':
      return renderNumberPanel(columnId, context);
    case 'date-range':
      return (
        <DateRangePickerPanel
          from={filters.dateFrom}
          onChange={({ from, to }) => {
            filters.setDateFrom(from);
            filters.setDateTo(to);
          }}
          summary={context.columnLabel(columnId)}
          to={filters.dateTo}
        />
      );
    case 'datetime-range':
      return (
        <DateTimeRangePanel
          onChange={(state) => filters.setDateTimeRange(state)}
          state={filters.dateTimeRange}
        />
      );
    case 'multi-select':
      if (columnId === 'account') return renderAccountPanel(context);
      if (columnId === 'asset') return renderAssetPanel(context);
      if (columnId === 'assetCategory') return renderAssetCategoryPanel(columnId, context);
      if (columnId === 'direction') return renderEntryTypePanel(columnId, context);
      if (columnId === 'resultKind') return renderResultUnitPanel(columnId, context);
      if (columnId === 'tags') return renderTagPanel(columnId, context);
      return null;
    case 'none':
      return null;
    default:
      return null;
  }
};
