import type { LegacyColumnDef } from '@tanstack/react-table/legacy';
import { Pencil, RotateCcw, Settings, Trash2, X } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import type { AccountDto, TableLayoutDto } from '../../../shared/desktop-api';
import { DataTable, type DataTableColumnFilterViewModel } from '../../components/data-table';
import type { DataTableColumnFilterSchema } from '../../components/data-table-filter';
import { useDataTableController } from '../../components/use-data-table-controller';
import { Checkbox } from '../../components/ui/checkbox';
import { FilterResetButton } from '../../components/ui/filter-reset-button';
import { createEmptyNumberFilterState } from '../../components/ui/number-filter-state';
import { IconButton } from '../../components/ui/icon-button';
import { SelectionToolbar } from '../../components/ui/selection-toolbar';
import { Tooltip } from '../../components/ui/tooltip';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import {
  ACCOUNT_COLUMN_IDS,
  ACCOUNT_COLUMN_SCHEMAS,
  ENTITY_STATUS_ACTIVE,
  ENTITY_STATUS_ARCHIVED,
  ENTITY_STATUS_OPTION_KEYS,
  ENTITY_TABLE_MODE,
  ENTITY_TABLE_SIZE_LIMITS,
  entityVisibility,
  getEntityTableColumns,
  normalizeEntityOrder,
  toEntityFilterEntries,
} from './entity-table.config';
import {
  createEntityTableFilterState,
  isEntityColumnFilterActive,
  isEntityFilterDefault,
  matchesEntityFilters,
  type EntityTableFilterState,
} from './entity-table-filters';
import { renderEntityFilterPanel } from './entity-filter-panel';
import { TableLayoutDialogView } from './table-layout-dialog-view';
import type { CatalogPresenter } from './use-catalog-presenter';

const DEFAULT_STATUSES: readonly string[] = [ENTITY_STATUS_ACTIVE];

interface AccountsTableProps {
  readonly accounts: readonly AccountDto[];
  readonly layout: TableLayoutDto | undefined;
  readonly presenter: CatalogPresenter;
  readonly quickCreate: ReactElement;
}

export const AccountsTable = ({
  accounts,
  layout,
  presenter,
  quickCreate,
}: AccountsTableProps): ReactElement => {
  const { t } = useTranslation();
  const [filterState, setFilterState] = useState<EntityTableFilterState>(() =>
    createEntityTableFilterState(DEFAULT_STATUSES),
  );
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutColumns, setLayoutColumns] = useState<
    readonly { readonly id: string; readonly label: string; readonly visible: boolean }[]
  >([]);
  const statusOptions = [
    { id: ENTITY_STATUS_ACTIVE, label: t(ENTITY_STATUS_OPTION_KEYS[ENTITY_STATUS_ACTIVE]) },
    { id: ENTITY_STATUS_ARCHIVED, label: t(ENTITY_STATUS_OPTION_KEYS[ENTITY_STATUS_ARCHIVED]) },
  ];
  const isColumnFilterActive = (
    columnId: string,
    kind: DataTableColumnFilterSchema['kind'],
  ): boolean => isEntityColumnFilterActive(filterState, columnId, kind, ACCOUNT_COLUMN_IDS.status);
  const filteredAccounts = useMemo(
    () =>
      accounts.filter((account) =>
        matchesEntityFilters(account, filterState, {
          balance: account.currentKnownBalanceUsd,
          opening: account.openingBalanceUsd,
          text: [account.name],
        }),
      ),
    [accounts, filterState],
  );
  const columns = useMemo<readonly LegacyColumnDef<AccountDto>[]>(
    () => [
      {
        enableResizing: false,
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            ariaLabel={t(TRANSLATION_KEYS.tableSelectAll)}
            checked={table.getIsAllRowsSelected()}
            onCheckedChange={(checked) => table.toggleAllRowsSelected(checked)}
          />
        ),
        id: ACCOUNT_COLUMN_IDS.selection,
        size: 48,
        cell: ({ row }) => (
          <Checkbox
            ariaLabel={t(TRANSLATION_KEYS.tableSelectRow)}
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked)}
          />
        ),
      },
      { accessorKey: 'name', header: t(TRANSLATION_KEYS.fieldAccount) },
      {
        accessorKey: 'openingBalanceUsd',
        cell: ({ row }) => `${row.original.openingBalanceUsd} ${t(TRANSLATION_KEYS.tradeUnitCash)}`,
        header: t(TRANSLATION_KEYS.fieldAccountOpening),
        id: ACCOUNT_COLUMN_IDS.opening,
      },
      {
        cell: ({ row }) => (
          <>
            {row.original.currentKnownBalanceUsd} {t(TRANSLATION_KEYS.tradeUnitCash)}
            {row.original.uncoveredTradeCount > 0 && (
              <span
                aria-label={t(TRANSLATION_KEYS.accountUncoveredWarning, {
                  count: row.original.uncoveredTradeCount,
                })}
                title={t(TRANSLATION_KEYS.accountUncoveredWarning, {
                  count: row.original.uncoveredTradeCount,
                })}
              >
                {' '}
                ⚠ {row.original.uncoveredTradeCount}
              </span>
            )}
          </>
        ),
        header: t(TRANSLATION_KEYS.fieldAccountBalance),
        id: ACCOUNT_COLUMN_IDS.balance,
      },
      {
        cell: ({ row }) =>
          row.original.archivedAt === null
            ? t(TRANSLATION_KEYS.statusActive)
            : t(TRANSLATION_KEYS.statusArchived),
        header: t(TRANSLATION_KEYS.fieldStatus),
        id: ACCOUNT_COLUMN_IDS.status,
      },
    ],
    [t],
  );
  const tableColumns = getEntityTableColumns('accounts');
  const controller = useDataTableController({
    columns,
    data: filteredAccounts,
    defaultColumns: tableColumns,
    defaultMode: ENTITY_TABLE_MODE,
    getColumnsForMode: entityVisibility(tableColumns),
    getRowId: (account) => account.id,
    isDataColumn: (id) => id !== ACCOUNT_COLUMN_IDS.selection,
    layout,
    layoutId: 'accounts',
    normalizeColumnOrder: normalizeEntityOrder(tableColumns.map((column) => column.id)),
    onLayoutChange: presenter.updateTableLayout,
    sizeLimits: ENTITY_TABLE_SIZE_LIMITS,
  });
  const resetLabel = t(TRANSLATION_KEYS.actionReset);
  const resetColumnFilter = (columnId: string, kind: DataTableColumnFilterSchema['kind']): void => {
    if (kind === 'text') {
      setFilterState((current) => ({ ...current, textQuery: '' }));
    } else if (kind === 'number') {
      setFilterState((current) => ({
        ...current,
        numberBounds: { ...current.numberBounds, [columnId]: createEmptyNumberFilterState() },
      }));
    } else {
      setFilterState((current) => ({ ...current, statuses: [...DEFAULT_STATUSES] }));
    }
  };
  const filters: readonly DataTableColumnFilterViewModel[] = toEntityFilterEntries(
    ACCOUNT_COLUMN_SCHEMAS,
  ).map(({ columnId, schema }) => {
    const columnLabel = t(schema.labelKey as Parameters<typeof t>[0]);
    return {
      active: isColumnFilterActive(columnId, schema.kind),
      columnId,
      content: renderEntityFilterPanel(columnId, schema, {
        categoryOptions: [],
        columnLabel: () => columnLabel,
        filterState,
        onCategoryChange: () => {},
        onNumberChange: (id, bounds) =>
          setFilterState((current) => ({
            ...current,
            numberBounds: { ...current.numberBounds, [id]: bounds },
          })),
        onStatusChange: (values) => setFilterState((current) => ({ ...current, statuses: values })),
        onTextChange: (value) => setFilterState((current) => ({ ...current, textQuery: value })),
        statusOptions,
      }),
      expanded: controller.activeFilterColumnId === columnId,
      label: t(TRANSLATION_KEYS.tableFilterColumn, { column: columnLabel }),
      onOpenChange: (open) => controller.setActiveFilter(open ? columnId : null),
      onReset: () => resetColumnFilter(columnId, schema.kind),
      resetLabel,
    };
  });
  const selected = controller.selectedRows;
  const selectedActiveIds = selected
    .filter((account) => account.archivedAt === null)
    .map((account) => account.id);
  const selectedArchivedIds = selected
    .filter((account) => account.archivedAt !== null)
    .map((account) => account.id);
  const openLayout = (): void => {
    setLayoutColumns(controller.columnControls);
    setLayoutOpen(true);
  };
  return (
    <>
      <div className="entities-toolbar" data-selection-active={selected.length > 0}>
        <div className="entities-quick-create-slot">{quickCreate}</div>
        <SelectionToolbar
          label={
            selected.length > 0
              ? t(TRANSLATION_KEYS.tableSelectedCount, { count: selected.length })
              : undefined
          }
        >
          <div className="table-selection-actions entity-table-selection-actions">
            {selected.length > 0 ? (
              <span>{t(TRANSLATION_KEYS.tableSelectedCount, { count: selected.length })}</span>
            ) : (
              <span aria-hidden="true" />
            )}
            <Tooltip content={t(TRANSLATION_KEYS.actionClearSelection)}>
              <IconButton
                className={selected.length > 0 ? '' : 'is-hidden'}
                disabled={selected.length === 0}
                label={t(TRANSLATION_KEYS.actionClearSelection)}
                onClick={controller.clearSelection}
              >
                <X aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content={t(TRANSLATION_KEYS.actionEdit)}>
              <IconButton
                className={selected.length === 1 ? '' : 'is-hidden'}
                disabled={selected.length !== 1}
                label={t(TRANSLATION_KEYS.actionEdit)}
                onClick={() => selected[0] !== undefined && presenter.editAccount(selected[0])}
                variant="edit"
              >
                <Pencil aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content={t(TRANSLATION_KEYS.actionDeleteSelected)}>
              <IconButton
                className={selectedActiveIds.length > 0 ? '' : 'is-hidden'}
                disabled={selectedActiveIds.length === 0}
                label={t(TRANSLATION_KEYS.actionDeleteSelected)}
                onClick={() => presenter.requestBulkAction('account', 'delete', selectedActiveIds)}
                variant="danger"
              >
                <Trash2 aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content={t(TRANSLATION_KEYS.actionRestore)}>
              <IconButton
                className={selectedArchivedIds.length > 0 ? '' : 'is-hidden'}
                disabled={selectedArchivedIds.length === 0}
                label={t(TRANSLATION_KEYS.actionRestore)}
                onClick={() =>
                  presenter.requestBulkAction('account', 'restore', selectedArchivedIds)
                }
              >
                <RotateCcw aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <div className="table-toolbar-actions">
              <FilterResetButton
                label={t(TRANSLATION_KEYS.tableFilterResetAll)}
                onReset={() => setFilterState(createEntityTableFilterState(DEFAULT_STATUSES))}
                visible={!isEntityFilterDefault(filterState)}
              />
              <Tooltip content={t(TRANSLATION_KEYS.tableLayout)}>
                <IconButton label={t(TRANSLATION_KEYS.tableLayout)} onClick={openLayout}>
                  <Settings aria-hidden="true" />
                </IconButton>
              </Tooltip>
            </div>
          </div>
        </SelectionToolbar>
      </div>
      <DataTable
        emptyMessage={t(
          accounts.length === 0 ? TRANSLATION_KEYS.tableEmptyAccounts : TRANSLATION_KEYS.tableEmpty,
        )}
        filters={filters}
        onRowDoubleClick={(account) => presenter.editAccount(account)}
        resizeColumnLabel={t(TRANSLATION_KEYS.tableResizeColumn)}
        scrollRegionLabel={t(TRANSLATION_KEYS.tableScrollRegion)}
        sortColumnLabel={t(TRANSLATION_KEYS.tableSortColumn)}
        table={controller.table}
      />
      {layoutOpen && (
        <TableLayoutDialogView
          applyLabel={t(TRANSLATION_KEYS.actionApply)}
          cancelLabel={t(TRANSLATION_KEYS.actionCancel)}
          closeLabel={t(TRANSLATION_KEYS.actionClose)}
          columns={layoutColumns}
          onApply={() => {
            controller.applyLayout(controller.mode, layoutColumns);
            setLayoutOpen(false);
          }}
          onClose={() => setLayoutOpen(false)}
          onToggleColumn={(id) =>
            setLayoutColumns((current) =>
              current.map((column) =>
                column.id === id ? { ...column, visible: !column.visible } : column,
              ),
            )
          }
          title={t(TRANSLATION_KEYS.tableLayout)}
        />
      )}
    </>
  );
};
