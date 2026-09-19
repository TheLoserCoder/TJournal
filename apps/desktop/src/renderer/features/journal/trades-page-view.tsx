import type { FormEvent, ReactElement } from 'react';
import { LayoutPanelTop, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type AccountDto,
  type CashMovementDto,
  type InstrumentDto,
  type UpdateCashMovementDto,
} from '../../../shared/desktop-api';
import { DataTable, type DataTableColumnFilterViewModel } from '../../components/data-table';
import { PageHeader } from '../../components/page-header';
import { Button } from '../../components/ui/button';
import { BUTTON_VARIANTS } from '../../components/ui/button.config';
import { Checkbox } from '../../components/ui/checkbox';
import { Combobox } from '../../components/ui/combobox';
import { DateRangePickerPanel } from '../../components/ui/date-range-picker';
import { DirectionToggle } from '../../components/ui/direction-toggle';
import { Dialog } from '../../components/ui/dialog';
import { IconButton } from '../../components/ui/icon-button';
import { SelectionToolbar } from '../../components/ui/selection-toolbar';
import { MultiSelectPanel } from '../../components/ui/multi-select';
import { Select, type SelectOption } from '../../components/ui/select';
import { TextField } from '../../components/ui/text-field';
import { HelpTooltip } from '../../components/ui/help-tooltip';
import { Tooltip } from '../../components/ui/tooltip';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { TRADE_RESULT_FILTERS, TRADE_TABLE_COLUMN_IDS } from './trade-table.config';
import type { TradesTablePresenter } from './use-trades-table-presenter';
import { TradeSummaryView } from './trade-summary-view';
import type { TradeSummaryPresenter } from './use-trade-summary-presenter';

interface TradesPageViewProps {
  readonly entryKind: 'trade' | 'deposit' | 'withdrawal';
  readonly legacyUnassignedCount: number;
  readonly direction: 'long' | 'short';
  readonly accounts: readonly AccountDto[];
  readonly accountId: string | null;
  readonly instruments: readonly InstrumentDto[];
  readonly onCreate: (event: FormEvent) => void;
  readonly onCashMovementUpdate: (input: UpdateCashMovementDto) => Promise<void>;
  readonly onEntryKindChange: (value: 'trade' | 'deposit' | 'withdrawal') => void;
  readonly onMovementAmountChange: (value: string) => void;
  readonly onOpenDetails: () => void;
  readonly onOpenLegacyMigration: () => void;
  readonly onOpenTableLayout: () => void;
  readonly onDirectionChange: (value: 'long' | 'short') => void;
  readonly onAccountChange: (value: string | null) => void;
  readonly onResultKindChange: (value: 'cash' | 'percent' | 'r') => void;
  readonly onResultValueChange: (value: string) => void;
  readonly onRiskUsdChange: (value: string) => void;
  readonly onSelectedDelete: () => void;
  readonly onSelectedEdit: () => void;
  readonly onSymbolChange: (value: string) => void;
  readonly resultKind: 'cash' | 'percent' | 'r';
  readonly resultValue: string;
  readonly resultPreviewUsd: string | null;
  readonly percentBaseUsd: string | null;
  readonly riskUsd: string;
  readonly movementAmount: string;
  readonly symbol: string;
  readonly tablePresenter: TradesTablePresenter;
  readonly summaryPresenter: TradeSummaryPresenter;
}

export const TradesPageView = ({
  entryKind,
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
  onResultKindChange,
  onResultValueChange,
  onRiskUsdChange,
  onSelectedDelete,
  onSelectedEdit,
  onSymbolChange,
  resultKind,
  resultValue,
  resultPreviewUsd,
  percentBaseUsd,
  riskUsd,
  movementAmount,
  symbol,
  summaryPresenter,
  tablePresenter,
}: TradesPageViewProps): ReactElement => {
  const { t } = useTranslation();
  const [editingMovement, setEditingMovement] = useState<CashMovementDto | null>(null);
  const accountOptions = useMemo(
    () =>
      accounts
        .filter((account) => account.archivedAt === null)
        .map((account) => ({ label: account.name, value: account.id })),
    [accounts],
  );
  const dateFilterContent = (
    <DateRangePickerPanel
      clearLabel={t(TRANSLATION_KEYS.actionReset)}
      from={tablePresenter.dateFrom}
      onChange={({ from, to }) => {
        tablePresenter.setDateFrom(from);
        tablePresenter.setDateTo(to);
      }}
      summary={t(TRANSLATION_KEYS.tableDateRange)}
      to={tablePresenter.dateTo}
    />
  );
  const resultOptions: readonly SelectOption[] = [
    { label: t(TRANSLATION_KEYS.tableResultAll), value: TRADE_RESULT_FILTERS.all },
    { label: t(TRANSLATION_KEYS.tradeUnitCash), value: TRADE_RESULT_FILTERS.cash },
    ...(percentBaseUsd === null || (percentBaseUsd !== '0' && !percentBaseUsd.startsWith('-'))
      ? [{ label: t(TRANSLATION_KEYS.tradeUnitPercent), value: TRADE_RESULT_FILTERS.percent }]
      : []),
    { label: t(TRANSLATION_KEYS.tradeUnitR), value: TRADE_RESULT_FILTERS.r },
  ];
  const hasEntryFeedback =
    (entryKind === 'trade' && (percentBaseUsd !== null || resultPreviewUsd !== null)) ||
    accountId === null ||
    legacyUnassignedCount > 0;
  const filters: readonly DataTableColumnFilterViewModel[] = [
    {
      active: tablePresenter.accountFilterIds.length > 0 || tablePresenter.includeUnassigned,
      columnId: TRADE_TABLE_COLUMN_IDS.account,
      content: (
        <div className="ui-filter-control-row">
          <MultiSelectPanel
            clearLabel={t(TRANSLATION_KEYS.actionReset)}
            emptyMessage={t(TRANSLATION_KEYS.fieldAccount)}
            onSelectedIdsChange={tablePresenter.setAccountFilterIds}
            options={tablePresenter.accountOptions}
            placeholder={t(TRANSLATION_KEYS.fieldAccount)}
            searchLabel={t(TRANSLATION_KEYS.fieldAccount)}
            selectedIds={tablePresenter.accountFilterIds}
            summary={t(TRANSLATION_KEYS.fieldAccount)}
          />
          <Checkbox
            ariaLabel={t(TRANSLATION_KEYS.accountUnassigned)}
            checked={tablePresenter.includeUnassigned}
            onCheckedChange={tablePresenter.setIncludeUnassigned}
          />
          <span>{t(TRANSLATION_KEYS.accountUnassigned)}</span>
        </div>
      ),
      expanded: tablePresenter.activeFilterColumnId === TRADE_TABLE_COLUMN_IDS.account,
      label: t(TRANSLATION_KEYS.tableFilterColumn, { column: t(TRANSLATION_KEYS.fieldAccount) }),
      onOpenChange: (open) =>
        tablePresenter.setActiveFilter(open ? TRADE_TABLE_COLUMN_IDS.account : null),
    },
    {
      active: tablePresenter.dateFrom !== '' || tablePresenter.dateTo !== '',
      columnId: TRADE_TABLE_COLUMN_IDS.closedAt,
      content: dateFilterContent,
      expanded: tablePresenter.activeFilterColumnId === TRADE_TABLE_COLUMN_IDS.closedAt,
      label: t(TRANSLATION_KEYS.tableFilterColumn, {
        column: t(TRANSLATION_KEYS.fieldDate),
      }),
      onOpenChange: (open) =>
        tablePresenter.setActiveFilter(open ? TRADE_TABLE_COLUMN_IDS.closedAt : null),
    },
    {
      active: tablePresenter.dateFrom !== '' || tablePresenter.dateTo !== '',
      columnId: TRADE_TABLE_COLUMN_IDS.closedAtTime,
      content: dateFilterContent,
      expanded: tablePresenter.activeFilterColumnId === TRADE_TABLE_COLUMN_IDS.closedAtTime,
      label: t(TRANSLATION_KEYS.tableFilterColumn, {
        column: t(TRANSLATION_KEYS.fieldDateTime),
      }),
      onOpenChange: (open) =>
        tablePresenter.setActiveFilter(open ? TRADE_TABLE_COLUMN_IDS.closedAtTime : null),
    },
    {
      active: tablePresenter.assetFilterIds.length > 0,
      columnId: TRADE_TABLE_COLUMN_IDS.asset,
      content: (
        <MultiSelectPanel
          clearLabel={t(TRANSLATION_KEYS.actionReset)}
          emptyMessage={t(TRANSLATION_KEYS.tableNoAssets)}
          onSelectedIdsChange={tablePresenter.setAssetFilterIds}
          options={tablePresenter.assetOptions}
          placeholder={t(TRANSLATION_KEYS.searchAssets)}
          searchLabel={t(TRANSLATION_KEYS.tableFilterAssets)}
          selectedIds={tablePresenter.assetFilterIds}
          summary={t(TRANSLATION_KEYS.tableAssetsSelected, {
            count: tablePresenter.assetFilterIds.length,
          })}
        />
      ),
      expanded: tablePresenter.activeFilterColumnId === TRADE_TABLE_COLUMN_IDS.asset,
      label: t(TRANSLATION_KEYS.tableFilterColumn, {
        column: t(TRANSLATION_KEYS.fieldAsset),
      }),
      onOpenChange: (open) =>
        tablePresenter.setActiveFilter(open ? TRADE_TABLE_COLUMN_IDS.asset : null),
    },
    {
      active: tablePresenter.resultFilter !== TRADE_RESULT_FILTERS.all,
      columnId: TRADE_TABLE_COLUMN_IDS.result,
      content: (
        <div className="ui-filter-control-row">
          <Select
            ariaLabel={t(TRANSLATION_KEYS.tableFilterResult)}
            onValueChange={(value) =>
              tablePresenter.setResultFilter(value as typeof tablePresenter.resultFilter)
            }
            options={resultOptions}
            value={tablePresenter.resultFilter}
          />
          <Tooltip content={t(TRANSLATION_KEYS.actionReset)}>
            <IconButton
              disabled={tablePresenter.resultFilter === TRADE_RESULT_FILTERS.all}
              label={t(TRANSLATION_KEYS.actionReset)}
              onClick={() => tablePresenter.setResultFilter(TRADE_RESULT_FILTERS.all)}
            >
              <RotateCcw aria-hidden="true" />
            </IconButton>
          </Tooltip>
        </div>
      ),
      expanded: tablePresenter.activeFilterColumnId === TRADE_TABLE_COLUMN_IDS.result,
      label: t(TRANSLATION_KEYS.tableFilterColumn, {
        column: t(TRANSLATION_KEYS.fieldResult),
      }),
      onOpenChange: (open) =>
        tablePresenter.setActiveFilter(open ? TRADE_TABLE_COLUMN_IDS.result : null),
    },
  ];

  return (
    <section className="trades-workspace">
      <div className="trades-heading-row">
        <PageHeader title={t(TRANSLATION_KEYS.navigationTrades)} />
      </div>
      <TradeSummaryView presenter={summaryPresenter} />
      <div className="trades-entry-bar">
        {tablePresenter.selectedCount > 0 ? (
          <SelectionToolbar
            label={t(TRANSLATION_KEYS.tableSelectedCount, {
              count: tablePresenter.selectedCount,
            })}
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
                  } else {
                    onSelectedEdit();
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
            <Tooltip content={t(TRANSLATION_KEYS.tableLayout)}>
              <IconButton label={t(TRANSLATION_KEYS.tableLayout)} onClick={onOpenTableLayout}>
                <LayoutPanelTop aria-hidden="true" />
              </IconButton>
            </Tooltip>
          </SelectionToolbar>
        ) : (
          <form className="trades-topbar" onSubmit={onCreate}>
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
                  onChange={onSymbolChange}
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
                  className="quick-entry-control quick-entry-control-result"
                  inputMode="decimal"
                  onChange={(event) => onResultValueChange(event.target.value)}
                  placeholder={t(TRANSLATION_KEYS.fieldResult)}
                  required
                  value={resultValue}
                />
                {resultKind === 'r' && (
                  <label className="quick-converter-field quick-entry-control">
                    <span className="quick-converter-label">
                      {t(TRANSLATION_KEYS.tradeOneRiskUsd)}
                      <HelpTooltip
                        content={t(TRANSLATION_KEYS.tradeOneRiskHelp)}
                        label={t(TRANSLATION_KEYS.actionHelp)}
                      />
                    </span>
                    <TextField
                      aria-label={t(TRANSLATION_KEYS.tradeOneRiskUsd)}
                      inputMode="decimal"
                      onChange={(event) => onRiskUsdChange(event.target.value)}
                      placeholder={t(TRANSLATION_KEYS.tradeOneRiskUsd)}
                      value={riskUsd}
                    />
                  </label>
                )}
                <Select
                  ariaLabel={t(TRANSLATION_KEYS.fieldUnit)}
                  className="quick-entry-control quick-entry-control-unit"
                  onValueChange={(value) => onResultKindChange(value as 'cash' | 'percent' | 'r')}
                  options={resultOptions.slice(1)}
                  placeholder={t(TRANSLATION_KEYS.fieldUnit)}
                  value={resultKind}
                />
                <Button
                  className="quick-entry-control quick-entry-control-add"
                  disabled={accountId === null}
                  type="submit"
                  variant={BUTTON_VARIANTS.primary}
                >
                  <Plus aria-hidden="true" />
                  {t(TRANSLATION_KEYS.actionAdd)}
                </Button>
                <Button
                  className="quick-entry-control quick-entry-control-details"
                  disabled={accountId === null}
                  onClick={onOpenDetails}
                  type="button"
                  variant={BUTTON_VARIANTS.accentGhost}
                >
                  {t(TRANSLATION_KEYS.tradeWithDetails)}
                </Button>
              </>
            ) : (
              <>
                <TextField
                  aria-label={t(TRANSLATION_KEYS.fieldResult)}
                  className="quick-entry-control quick-entry-control-result"
                  inputMode="decimal"
                  onChange={(event) => onMovementAmountChange(event.target.value)}
                  placeholder={t(TRANSLATION_KEYS.fieldResult)}
                  required
                  value={movementAmount}
                />
                <Button
                  className="quick-entry-control quick-entry-control-add"
                  disabled={accountId === null}
                  type="submit"
                  variant={BUTTON_VARIANTS.primary}
                >
                  <Plus aria-hidden="true" />
                  {t(TRANSLATION_KEYS.actionAdd)}
                </Button>
              </>
            )}
            <div className="trades-topbar-spacer" />
            <Tooltip content={t(TRANSLATION_KEYS.tableLayout)}>
              <IconButton label={t(TRANSLATION_KEYS.tableLayout)} onClick={onOpenTableLayout}>
                <LayoutPanelTop aria-hidden="true" />
              </IconButton>
            </Tooltip>
          </form>
        )}
      </div>
      {hasEntryFeedback && (
        <div className="trades-entry-feedback">
          {entryKind === 'trade' && percentBaseUsd !== null && (
            <p className="form-help">
              {t(TRANSLATION_KEYS.tradePercentBase, { value: percentBaseUsd })}
            </p>
          )}
          {entryKind === 'trade' && resultPreviewUsd !== null && (
            <p className="form-help">
              {t(TRANSLATION_KEYS.tradeUsdPreview, { value: resultPreviewUsd })}
            </p>
          )}
          {accountId === null && <p className="form-help">{t(TRANSLATION_KEYS.accountRequired)}</p>}
          {legacyUnassignedCount > 0 && (
            <div className="legacy-account-warning">
              <p className="form-help">{t(TRANSLATION_KEYS.accountLegacyWarning)}</p>
              <Button
                onClick={onOpenLegacyMigration}
                type="button"
                variant={BUTTON_VARIANTS.secondary}
              >
                {t(TRANSLATION_KEYS.accountLegacyReview)}
              </Button>
            </div>
          )}
        </div>
      )}
      <div className="trades-table-area">
        <DataTable
          emptyMessage={t(TRANSLATION_KEYS.tableEmpty)}
          filters={filters}
          resizeColumnLabel={t(TRANSLATION_KEYS.tableResizeColumn)}
          sortColumnLabel={t(TRANSLATION_KEYS.tableSortColumn)}
          table={tablePresenter.table}
        />
      </div>
      {editingMovement !== null && (
        <Dialog
          closeLabel={t(TRANSLATION_KEYS.actionClose)}
          onOpenChange={(open) => !open && setEditingMovement(null)}
          open
          title={t(TRANSLATION_KEYS.tableCashMovements)}
        >
          <form
            className="entity-editor-form"
            onSubmit={(event) => {
              event.preventDefault();
              void onCashMovementUpdate(editingMovement).then(() => setEditingMovement(null));
            }}
          >
            <label>
              {t(TRANSLATION_KEYS.fieldAccount)}
              <Select
                ariaLabel={t(TRANSLATION_KEYS.fieldAccount)}
                layer="dialog"
                onValueChange={(value) =>
                  setEditingMovement((current) =>
                    current === null ? current : { ...current, accountId: value },
                  )
                }
                options={accounts
                  .filter(
                    (account) =>
                      account.archivedAt === null || account.id === editingMovement.accountId,
                  )
                  .map((account) => ({ label: account.name, value: account.id }))}
                value={editingMovement.accountId}
              />
            </label>
            <label>
              {t(TRANSLATION_KEYS.fieldResult)}
              <TextField
                aria-label={t(TRANSLATION_KEYS.fieldResult)}
                inputMode="decimal"
                onChange={(event) =>
                  setEditingMovement((current) =>
                    current === null ? current : { ...current, amountUsd: event.target.value },
                  )
                }
                value={editingMovement.amountUsd}
              />
            </label>
            <Select
              ariaLabel={t(TRANSLATION_KEYS.tableEntryType)}
              layer="dialog"
              onValueChange={(value) =>
                setEditingMovement((current) =>
                  current === null
                    ? current
                    : { ...current, kind: value as CashMovementDto['kind'] },
                )
              }
              options={[
                { label: t(TRANSLATION_KEYS.accountDeposit), value: 'deposit' },
                { label: t(TRANSLATION_KEYS.accountWithdrawal), value: 'withdrawal' },
              ]}
              value={editingMovement.kind}
            />
            <div className="ui-dialog-actions">
              <Button
                onClick={() => setEditingMovement(null)}
                type="button"
                variant={BUTTON_VARIANTS.secondary}
              >
                {t(TRANSLATION_KEYS.actionCancel)}
              </Button>
              <Button type="submit" variant={BUTTON_VARIANTS.success}>
                {t(TRANSLATION_KEYS.actionSave)}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
};
