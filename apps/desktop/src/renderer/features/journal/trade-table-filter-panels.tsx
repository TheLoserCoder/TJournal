import type { ReactElement } from 'react';

import type { InstrumentCategory } from '../../../shared/desktop-api';
import { Checkbox } from '../../components/ui/checkbox';
import type { DataTableColumnFilterSchema } from '../../components/data-table-filter';
import { DateRangePickerPanel } from '../../components/ui/date-range-picker';
import { DateTimeRangePanel } from '../../components/ui/datetime-range-panel';
import { CheckboxListPanel, MultiSelectPanel } from '../../components/ui/multi-select';
import { NumberFilterPanel } from '../../components/ui/number-filter-panel';
import { createEmptyNumberFilterState } from '../../components/ui/number-filter-state';
import { createEmptyDateTimeRangeFilterState } from '../../components/ui/datetime-range-filter-state';
import type { SelectOption } from '../../components/ui/select';
import { TextFilterPanel } from '../../components/ui/text-filter-panel';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import {
  TRADE_TAG_UNTAGGED_FILTER_ID,
  type TradeEntryFilter,
  type TradeResultUnitFilter,
  type TradeReviewStatusFilter,
} from './trade-table-filters';
import {
  TRADE_DETAIL_COLUMN_FIELDS,
  TRADE_RESULT_FILTERS,
  TRADE_TABLE_COLUMN_IDS,
  type TradeNotePresence,
  type TradeTableColumnId,
} from './trade-table.config';
import type {
  TradeTableFiltersPresenter,
  TradesTablePresenter,
} from './use-trades-table-presenter';

/** Column id to its localized header key; shared by the table and its filters. */
export const TRADE_COLUMN_LABEL_KEYS: Readonly<Record<string, string>> = {
  [TRADE_TABLE_COLUMN_IDS.account]: TRANSLATION_KEYS.fieldAccount,
  [TRADE_TABLE_COLUMN_IDS.asset]: TRANSLATION_KEYS.fieldAsset,
  [TRADE_TABLE_COLUMN_IDS.assetCategory]: TRANSLATION_KEYS.fieldAssetType,
  [TRADE_TABLE_COLUMN_IDS.closedAt]: TRANSLATION_KEYS.fieldDate,
  [TRADE_TABLE_COLUMN_IDS.closedAtTime]: TRANSLATION_KEYS.fieldDateTime,
  [TRADE_TABLE_COLUMN_IDS.commissionUsd]: TRANSLATION_KEYS.fieldCommission,
  [TRADE_TABLE_COLUMN_IDS.direction]: TRANSLATION_KEYS.fieldType,
  [TRADE_TABLE_COLUMN_IDS.entryPrice]: TRANSLATION_KEYS.fieldEntryPrice,
  [TRADE_TABLE_COLUMN_IDS.exitCount]: TRANSLATION_KEYS.fieldExitCount,
  [TRADE_TABLE_COLUMN_IDS.id]: TRANSLATION_KEYS.tableFilterIdentifierAndNotes,
  [TRADE_TABLE_COLUMN_IDS.notes]: TRANSLATION_KEYS.fieldNotes,
  [TRADE_TABLE_COLUMN_IDS.quantityLots]: TRANSLATION_KEYS.fieldQuantityLots,
  [TRADE_TABLE_COLUMN_IDS.result]: TRANSLATION_KEYS.fieldResult,
  [TRADE_TABLE_COLUMN_IDS.resultKind]: TRANSLATION_KEYS.fieldUnit,
  [TRADE_TABLE_COLUMN_IDS.reviewStatus]: TRANSLATION_KEYS.tradeReviewStatus,
  [TRADE_TABLE_COLUMN_IDS.spreadTicks]: TRANSLATION_KEYS.fieldSpreadTicks,
  [TRADE_TABLE_COLUMN_IDS.stopLoss]: TRANSLATION_KEYS.fieldStopLoss,
  [TRADE_TABLE_COLUMN_IDS.tags]: TRANSLATION_KEYS.fieldTag,
};

/** Clears exactly one column's filter, leaving every other filter untouched. */
export const resetTradeColumnFilter = (
  filters: TradeTableFiltersPresenter,
  columnId: string,
): void => {
  const detailField = TRADE_DETAIL_COLUMN_FIELDS[columnId as TradeTableColumnId];
  if (detailField !== undefined) {
    filters.setDetailBounds(detailField, undefined);
    return;
  }
  switch (columnId) {
    case TRADE_TABLE_COLUMN_IDS.account:
      filters.setAccountFilterIds([]);
      filters.setAccountIncludeUnassigned(false);
      break;
    case TRADE_TABLE_COLUMN_IDS.asset:
      filters.setAssetFilterIds([]);
      break;
    case TRADE_TABLE_COLUMN_IDS.assetCategory:
      filters.setAssetCategoryFilters([]);
      break;
    case TRADE_TABLE_COLUMN_IDS.closedAt:
      filters.setDateFrom('');
      filters.setDateTo('');
      break;
    case TRADE_TABLE_COLUMN_IDS.closedAtTime:
      filters.setDateTimeRange(createEmptyDateTimeRangeFilterState());
      break;
    case TRADE_TABLE_COLUMN_IDS.direction:
      filters.setEntryFilters([]);
      break;
    case TRADE_TABLE_COLUMN_IDS.id:
      filters.setTextQuery('');
      break;
    case TRADE_TABLE_COLUMN_IDS.result:
      filters.setResultBounds(createEmptyNumberFilterState());
      break;
    case TRADE_TABLE_COLUMN_IDS.resultKind:
      filters.setResultUnit(TRADE_RESULT_FILTERS.all);
      break;
    case TRADE_TABLE_COLUMN_IDS.reviewStatus:
      filters.setReviewStatuses([]);
      break;
    case TRADE_TABLE_COLUMN_IDS.notes:
      filters.setNotePresence([]);
      break;
    case TRADE_TABLE_COLUMN_IDS.tags:
      filters.setTagFilterIds([]);
      filters.setTagIncludeUntagged(false);
      break;
    default:
      break;
  }
};

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
  readonly noteOptions: readonly { readonly id: string; readonly label: string }[];
  readonly presenter: TradesTablePresenter;
  readonly resultUnitLabel: string;
  readonly reviewStatusOptions: readonly { readonly id: string; readonly label: string }[];
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

const renderNumberPanel = (columnId: string, context: FilterPanelContext): ReactElement => {
  const filters = context.presenter.filters;
  const detailField = TRADE_DETAIL_COLUMN_FIELDS[columnId as TradeTableColumnId];
  if (detailField !== undefined) {
    return (
      <NumberFilterPanel
        label={context.columnLabel(columnId)}
        onChange={(state) => filters.setDetailBounds(detailField, state)}
        state={filters.detailBounds[detailField] ?? createEmptyNumberFilterState()}
        unit={
          columnId === TRADE_TABLE_COLUMN_IDS.commissionUsd ? context.resultUnitLabel : undefined
        }
      />
    );
  }
  return (
    <NumberFilterPanel
      label={context.columnLabel(columnId)}
      onChange={(state) => filters.setResultBounds(state)}
      state={filters.resultBounds}
      unit={context.resultUnitLabel}
    />
  );
};

const renderReviewStatusPanel = (columnId: string, context: FilterPanelContext): ReactElement => (
  <CheckboxListPanel
    onSelectedIdsChange={(ids) =>
      context.presenter.filters.setReviewStatuses(ids as readonly TradeReviewStatusFilter[])
    }
    options={context.reviewStatusOptions}
    searchLabel={context.columnLabel(columnId)}
    selectedIds={context.presenter.filters.reviewStatuses}
  />
);

const renderNotesPanel = (columnId: string, context: FilterPanelContext): ReactElement => (
  <CheckboxListPanel
    onSelectedIdsChange={(ids) =>
      context.presenter.filters.setNotePresence(ids as readonly TradeNotePresence[])
    }
    options={context.noteOptions}
    searchLabel={context.columnLabel(columnId)}
    selectedIds={context.presenter.filters.notePresence}
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
      if (columnId === TRADE_TABLE_COLUMN_IDS.account) return renderAccountPanel(context);
      if (columnId === TRADE_TABLE_COLUMN_IDS.asset) return renderAssetPanel(context);
      if (columnId === TRADE_TABLE_COLUMN_IDS.assetCategory) {
        return renderAssetCategoryPanel(columnId, context);
      }
      if (columnId === TRADE_TABLE_COLUMN_IDS.direction)
        return renderEntryTypePanel(columnId, context);
      if (columnId === TRADE_TABLE_COLUMN_IDS.resultKind) {
        return renderResultUnitPanel(columnId, context);
      }
      if (columnId === TRADE_TABLE_COLUMN_IDS.reviewStatus) {
        return renderReviewStatusPanel(columnId, context);
      }
      if (columnId === TRADE_TABLE_COLUMN_IDS.notes) return renderNotesPanel(columnId, context);
      if (columnId === TRADE_TABLE_COLUMN_IDS.tags) return renderTagPanel(columnId, context);
      return null;
    case 'none':
      return null;
    default:
      return null;
  }
};
