import type { FormEvent, ReactElement } from 'react';
import { Ellipsis, Pencil, Plus, Settings, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type AccountDto,
  type CashMovementDto,
  type InstrumentDto,
  type TagDto,
  type TradeResultKind,
  type UpdateCashMovementDto,
} from '../../../shared/desktop-api';
import { DataTable, type DataTableColumnFilterViewModel } from '../../components/data-table';
import { PageHeader } from '../../components/page-header';
import { Button } from '../../components/ui/button';
import { BUTTON_VARIANTS } from '../../components/ui/button.config';
import { Combobox } from '../../components/ui/combobox';
import { DirectionToggle } from '../../components/ui/direction-toggle';
import { FilterResetButton } from '../../components/ui/filter-reset-button';
import { IconButton } from '../../components/ui/icon-button';
import { SelectionToolbar } from '../../components/ui/selection-toolbar';
import { Select, type SelectOption } from '../../components/ui/select';
import { TextField } from '../../components/ui/text-field';
import { Tooltip } from '../../components/ui/tooltip';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { CashMovementDialogView } from './cash-movement-dialog-view';
import { formatDecimalString } from './format-decimal';
import { LegacyAccountWarning } from './legacy-account-warning-view';
import { TRADE_TABLE_FILTER_SCHEMAS } from './trade-table.config';
import { getTradeTableFilterAwareness, isTradeColumnFilterActive } from './trade-table-filters';
import {
  renderTradeFilterPanel,
  resetTradeColumnFilter,
  TRADE_COLUMN_LABEL_KEYS,
  type FilterPanelContext,
} from './trade-table-filter-panels';
import { TRADE_TABLE_ROW_HEIGHT } from './trade-table.config';
import { TagPicker } from './tag-picker';
import type { TradesTablePresenter } from './use-trades-table-presenter';
import { TradeSummaryView } from './trade-summary-view';
import type { TradeSummaryPresenter } from './use-trade-summary-presenter';

interface TradesPageViewProps {
  readonly entryKind: 'trade' | 'deposit' | 'withdrawal';
  readonly legacyLookupEmpty: boolean;
  readonly legacyUnassignedCount: number;
  readonly direction: 'long' | 'short';
  readonly accounts: readonly AccountDto[];
  readonly accountId: string | null;
  readonly instruments: readonly InstrumentDto[];
  readonly onCreate: (event: FormEvent) => void;
  readonly onCashMovementUpdate: (input: UpdateCashMovementDto) => Promise<boolean>;
  readonly onEntryKindChange: (value: 'trade' | 'deposit' | 'withdrawal') => void;
  readonly onMovementAmountChange: (value: string) => void;
  readonly onOpenDetails: () => void;
  readonly onOpenLegacyMigration: () => void;
  readonly onOpenTableLayout: () => void;
  readonly onDirectionChange: (value: 'long' | 'short') => void;
  readonly onAccountChange: (value: string | null) => void;
  readonly onEditTrade: (tradeId: string) => void;
  readonly onResultKindChange: (value: 'cash' | 'percent' | 'r') => void;
  readonly onResultValueChange: (value: string) => void;
  readonly onSelectedDelete: () => void;
  readonly onSymbolChange: (value: string) => void;
  readonly createAssetLabel: (value: string) => string;
  readonly createTagLabel: (name: string) => string;
  readonly onCreateTag: (name: string) => Promise<void>;
  readonly onTagIdsChange: (ids: readonly string[]) => void;
  readonly resultKind: 'cash' | 'percent' | 'r';
  readonly resultValue: string;
  readonly resultPreviewUsd: string | null;
  readonly percentBaseUsd: string | null;
  readonly movementAmount: string;
  readonly symbol: string;
  readonly tagIds: readonly string[];
  readonly tags: readonly TagDto[];
  readonly tablePresenter: TradesTablePresenter;
  readonly summaryPresenter: TradeSummaryPresenter;
}

export const TradesPageView = ({
  entryKind,
  legacyLookupEmpty,
  legacyUnassignedCount,
  direction,
  accounts,
  accountId,
  instruments,
  onCreate,
  onCashMovementUpdate,
  onEntryKindChange,
  onMovementAmountChange,
  onOpenDetails,
  onOpenLegacyMigration,
  onOpenTableLayout,
  onDirectionChange,
  onAccountChange,
  onEditTrade,
  onResultKindChange,
  onResultValueChange,
  onSelectedDelete,
  onSymbolChange,
  createAssetLabel,
  createTagLabel,
  onCreateTag,
  onTagIdsChange,
  resultKind,
  resultValue,
  resultPreviewUsd,
  percentBaseUsd,
  movementAmount,
  symbol,
  tagIds,
  tags,
  summaryPresenter,
  tablePresenter,
}: TradesPageViewProps): ReactElement => {
  const { i18n, t } = useTranslation();
  const [editingMovement, setEditingMovement] = useState<CashMovementDto | null>(null);
  const accountOptions = useMemo(
    () =>
      accounts
        .filter((account) => account.archivedAt === null)
        .map((account) => ({ label: account.name, value: account.id })),
    [accounts],
  );
  const columnLabel = (columnId: string): string => {
    const key = TRADE_COLUMN_LABEL_KEYS[columnId];
    return key === undefined ? columnId : t(key as Parameters<typeof t>[0]);
  };
  const unitOptions: readonly SelectOption[] = [
    { label: t(TRANSLATION_KEYS.tradeUnitCash), value: 'cash' },
    { label: t(TRANSLATION_KEYS.tradeUnitPercent), value: 'percent' },
    { label: t(TRANSLATION_KEYS.tradeUnitR), value: 'r' },
  ];
  const filterContext: FilterPanelContext = {
    accountOptions: tablePresenter.accountOptions,
    assetCategoryOptions: tablePresenter.assetCategoryOptions,
    assetOptions: tablePresenter.assetOptions,
    columnLabel,
    entryOptions: tablePresenter.filters.entryFilterOptions.map((option) => ({
      label: option.label,
      value: option.value,
    })),
    messages: {
      accountUnassigned: t(TRANSLATION_KEYS.accountUnassigned),
      filterSearch: t(TRANSLATION_KEYS.tableFilterSearch),
      noAssets: t(TRANSLATION_KEYS.tableNoAssets),
      noTags: t(TRANSLATION_KEYS.tagEmpty),
      tagsUntagged: t(TRANSLATION_KEYS.tagFilterUntagged),
    },
    noteOptions: [
      { id: 'entry', label: t(TRANSLATION_KEYS.tradeEntryNote) },
      { id: 'review', label: t(TRANSLATION_KEYS.tradeReviewNote) },
    ],
    presenter: tablePresenter,
    resultUnitLabel: t(TRANSLATION_KEYS.tradeUnitCash),
    reviewStatusOptions: [
      { id: 'unreviewed', label: t(TRANSLATION_KEYS.tradeReviewUnreviewed) },
      { id: 'reviewed', label: t(TRANSLATION_KEYS.tradeReviewReviewed) },
    ],
    tagOptions: tablePresenter.tagOptions,
    unitOptions,
  };
  const awareness = getTradeTableFilterAwareness(tablePresenter.filters);
  const resetLabel = t(TRANSLATION_KEYS.actionReset);
  const filters: readonly DataTableColumnFilterViewModel[] = Object.entries(
    TRADE_TABLE_FILTER_SCHEMAS,
  ).map(([columnId, schema]) => ({
    active: isTradeColumnFilterActive(columnId, awareness),
    columnId,
    content: renderTradeFilterPanel(columnId, schema, filterContext),
    expanded: tablePresenter.activeFilterColumnId === columnId,
    label: t(TRANSLATION_KEYS.tableFilterColumn, { column: columnLabel(columnId) }),
    onOpenChange: (open) => tablePresenter.setActiveFilter(open ? columnId : null),
    onReset: () => resetTradeColumnFilter(tablePresenter.filters, columnId),
    resetLabel,
  }));
  const hasEntryFeedback = accountId === null || legacyUnassignedCount > 0;
  // Quick add is disabled exactly when the form has nothing to submit: no
  // account, no asset symbol for a trade, or an empty amount/result. The
  // details action is independent, because it opens its own form.
  const quickAddDisabled =
    accountId === null ||
    (entryKind === 'trade'
      ? symbol.trim() === '' || resultValue.trim() === ''
      : movementAmount.trim() === '');
  // A USD result is already in USD, so the conversion preview is only useful
  // for percent and R inputs.
  const conversionElement =
    resultPreviewUsd === null || resultKind === 'cash' ? null : (
      <span className="quick-entry-conversion">
        {t(TRANSLATION_KEYS.tradeConversionPreview, {
          unit: t(TRANSLATION_KEYS.tradeUnitCash),
          value: formatDecimalString(resultPreviewUsd, i18n.language),
        })}
      </span>
    );
  const conversionPreview =
    conversionElement === null || percentBaseUsd === null ? (
      conversionElement
    ) : (
      <Tooltip content={t(TRANSLATION_KEYS.tradePercentBase, { value: percentBaseUsd })}>
        {conversionElement}
      </Tooltip>
    );

  return (
    <section className="trades-workspace">
      <div className="trades-heading-row">
        <PageHeader title={t(TRANSLATION_KEYS.navigationTrades)} />
      </div>
      <TradeSummaryView presenter={summaryPresenter} />
      <div className="trades-entry-bar">
        {/* Both action layers share one grid cell so selecting rows never moves the table. */}
        <div
          aria-hidden={tablePresenter.selectedCount > 0 ? 'true' : undefined}
          className="trades-entry-layer"
          data-active={tablePresenter.selectedCount > 0 ? 'false' : 'true'}
          inert={tablePresenter.selectedCount > 0}
        >
          <form className="trades-topbar" onSubmit={onCreate}>
            <div
              className="trades-topbar-fields"
              data-conversion={conversionPreview === null ? 'false' : 'true'}
              data-entry-kind={entryKind === 'trade' ? 'trade' : 'movement'}
            >
              <Select
                ariaLabel={t(TRANSLATION_KEYS.tableEntryType)}
                className="quick-entry-control quick-entry-control-entry-kind"
                onValueChange={(value) =>
                  onEntryKindChange(value as 'trade' | 'deposit' | 'withdrawal')
                }
                options={[
                  { label: t(TRANSLATION_KEYS.entryTrade), value: 'trade' },
                  { label: t(TRANSLATION_KEYS.accountDeposit), value: 'deposit' },
                  { label: t(TRANSLATION_KEYS.accountWithdrawal), value: 'withdrawal' },
                ]}
                value={entryKind}
              />
              <Select
                ariaLabel={t(TRANSLATION_KEYS.fieldAccount)}
                className="quick-entry-control quick-entry-control-account"
                onValueChange={onAccountChange}
                options={accountOptions}
                placeholder={t(TRANSLATION_KEYS.fieldAccount)}
                value={accountId ?? ''}
              />
              {entryKind === 'trade' ? (
                <>
                  <Combobox
                    ariaLabel={t(TRANSLATION_KEYS.fieldAsset)}
                    className="quick-entry-control quick-entry-control-asset"
                    createLabel={createAssetLabel}
                    onChange={onSymbolChange}
                    onCreateOption={onSymbolChange}
                    options={instruments
                      .filter((instrument) => instrument.archivedAt === null)
                      .map((instrument) => instrument.symbol)}
                    placeholder={t(TRANSLATION_KEYS.fieldAsset)}
                    value={symbol}
                  />
                  <DirectionToggle
                    ariaLabel={t(TRANSLATION_KEYS.fieldDirection)}
                    className="quick-entry-control quick-entry-control-direction"
                    longLabel={t(TRANSLATION_KEYS.tradeDirectionLong)}
                    onChange={onDirectionChange}
                    shortLabel={t(TRANSLATION_KEYS.tradeDirectionShort)}
                    value={direction}
                  />
                  <TextField
                    aria-label={t(TRANSLATION_KEYS.fieldResult)}
                    className="quick-entry-control quick-entry-control-result"
                    inputMode="decimal"
                    onChange={(event) => onResultValueChange(event.target.value)}
                    placeholder={t(TRANSLATION_KEYS.fieldResult)}
                    required
                    value={resultValue}
                  />
                  <Select
                    ariaLabel={t(TRANSLATION_KEYS.fieldUnit)}
                    className="quick-entry-control quick-entry-control-unit"
                    onValueChange={(value) => onResultKindChange(value as TradeResultKind)}
                    options={unitOptions}
                    placeholder={t(TRANSLATION_KEYS.fieldUnit)}
                    value={resultKind}
                  />
                  {conversionPreview}
                  <TagPicker
                    className="quick-entry-control quick-entry-control-tags"
                    createLabel={createTagLabel}
                    emptyMessage={t(TRANSLATION_KEYS.tagEmpty)}
                    hasSelection={tagIds.length > 0}
                    label={t(TRANSLATION_KEYS.tagPickerLabel)}
                    onCreateTag={onCreateTag}
                    onSelectedIdsChange={onTagIdsChange}
                    options={tags}
                    placeholder={t(TRANSLATION_KEYS.tagPickerPlaceholder)}
                    searchPlaceholder={t(TRANSLATION_KEYS.tableFilterSearch)}
                    selectedIds={tagIds}
                  />
                </>
              ) : (
                <TextField
                  aria-label={t(TRANSLATION_KEYS.fieldResult)}
                  className="quick-entry-control quick-entry-control-result"
                  inputMode="decimal"
                  onChange={(event) => onMovementAmountChange(event.target.value)}
                  placeholder={t(TRANSLATION_KEYS.fieldResult)}
                  required
                  value={movementAmount}
                />
              )}
            </div>
            <div className="trades-topbar-actions">
              <Button
                className="quick-entry-control quick-entry-control-add"
                disabled={quickAddDisabled}
                type="submit"
                variant={BUTTON_VARIANTS.primary}
              >
                <Plus aria-hidden="true" />
                {t(TRANSLATION_KEYS.actionAdd)}
              </Button>
              {entryKind === 'trade' && (
                <Button
                  aria-label={t(TRANSLATION_KEYS.tradeWithDetails)}
                  className="quick-entry-control quick-entry-control-details"
                  disabled={accountId === null}
                  onClick={onOpenDetails}
                  type="button"
                  variant={BUTTON_VARIANTS.accentGhost}
                >
                  <Ellipsis aria-hidden="true" className="quick-entry-details-compact" />
                  <span className="quick-entry-details-label">
                    {t(TRANSLATION_KEYS.tradeWithDetails)}
                  </span>
                </Button>
              )}
              <div className="table-toolbar-actions">
                <FilterResetButton
                  label={t(TRANSLATION_KEYS.tableFilterResetAll)}
                  onReset={tablePresenter.filters.reset}
                  visible={tablePresenter.filters.active}
                />
                <Tooltip content={t(TRANSLATION_KEYS.tableLayout)}>
                  <IconButton label={t(TRANSLATION_KEYS.tableLayout)} onClick={onOpenTableLayout}>
                    <Settings aria-hidden="true" />
                  </IconButton>
                </Tooltip>
              </div>
            </div>
          </form>
        </div>
        <div
          aria-hidden={tablePresenter.selectedCount === 0 ? 'true' : undefined}
          className="trades-entry-layer"
          data-active={tablePresenter.selectedCount > 0 ? 'true' : 'false'}
          inert={tablePresenter.selectedCount === 0}
        >
          <SelectionToolbar
            label={
              tablePresenter.selectedCount > 0
                ? t(TRANSLATION_KEYS.tableSelectedCount, {
                    count: tablePresenter.selectedCount,
                  })
                : undefined
            }
          >
            <Tooltip content={t(TRANSLATION_KEYS.actionClearSelection)}>
              <IconButton
                label={t(TRANSLATION_KEYS.actionClearSelection)}
                onClick={tablePresenter.clearSelection}
              >
                <X aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content={t(TRANSLATION_KEYS.actionEdit)}>
              <IconButton
                className={tablePresenter.selectedCount === 1 ? '' : 'is-hidden'}
                disabled={tablePresenter.selectedCount !== 1}
                label={t(TRANSLATION_KEYS.actionEdit)}
                onClick={() => {
                  if (tablePresenter.selectedCashMovement !== null) {
                    setEditingMovement(tablePresenter.selectedCashMovement);
                  } else if (tablePresenter.selectedTrade !== null) {
                    onEditTrade(tablePresenter.selectedTrade.id);
                  }
                }}
                variant="edit"
              >
                <Pencil aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content={t(TRANSLATION_KEYS.actionDeleteSelected)}>
              <IconButton
                variant="danger"
                label={t(TRANSLATION_KEYS.actionDeleteSelected)}
                onClick={onSelectedDelete}
              >
                <Trash2 aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <div className="table-toolbar-actions">
              <FilterResetButton
                label={t(TRANSLATION_KEYS.tableFilterResetAll)}
                onReset={tablePresenter.filters.reset}
                visible={tablePresenter.filters.active}
              />
              <Tooltip content={t(TRANSLATION_KEYS.tableLayout)}>
                <IconButton label={t(TRANSLATION_KEYS.tableLayout)} onClick={onOpenTableLayout}>
                  <Settings aria-hidden="true" />
                </IconButton>
              </Tooltip>
            </div>
          </SelectionToolbar>
        </div>
      </div>
      {hasEntryFeedback && (
        <div className="trades-entry-feedback">
          {accountId === null && <p className="form-help">{t(TRANSLATION_KEYS.accountRequired)}</p>}
          <LegacyAccountWarning
            lookupEmpty={legacyLookupEmpty}
            onReview={onOpenLegacyMigration}
            unassignedCount={legacyUnassignedCount}
          />
        </div>
      )}
      <div className="trades-table-area">
        <DataTable
          emptyMessage={t(
            tablePresenter.hasEntries ? TRANSLATION_KEYS.tableEmpty : TRANSLATION_KEYS.journalEmpty,
          )}
          filters={filters}
          onRowDoubleClick={(entry) => {
            if (entry.kind === 'trade') onEditTrade(entry.trade.id);
            else setEditingMovement(entry.movement);
          }}
          resizeColumnLabel={t(TRANSLATION_KEYS.tableResizeColumn)}
          scrollRegionLabel={t(TRANSLATION_KEYS.tableScrollRegion)}
          sortColumnLabel={t(TRANSLATION_KEYS.tableSortColumn)}
          table={tablePresenter.table}
          virtualization={{
            hasMore: tablePresenter.hasMore,
            hasPrevious: tablePresenter.hasPrevious,
            loadingLabel: t(TRANSLATION_KEYS.tableLoadingMore),
            loading: tablePresenter.loading,
            onLoadMore: tablePresenter.loadMore,
            onLoadPrevious: tablePresenter.loadPrevious,
            rowHeight: TRADE_TABLE_ROW_HEIGHT,
            rowStartIndex: tablePresenter.virtualRowStartIndex,
            totalRowCount: tablePresenter.virtualRowCount,
          }}
        />
      </div>
      {editingMovement !== null && (
        <CashMovementDialogView
          accounts={accounts}
          movement={editingMovement}
          onClose={() => setEditingMovement(null)}
          onSubmit={onCashMovementUpdate}
        />
      )}
    </section>
  );
};
