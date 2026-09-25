import type { LegacyColumnDef } from '@tanstack/react-table/legacy';
import { Pencil, Settings, Trash2, X } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import type { TableLayoutDto, TagDto } from '../../../shared/desktop-api';
import { DataTable, type DataTableColumnFilterViewModel } from '../../components/data-table';
import type { DataTableColumnFilterSchema } from '../../components/data-table-filter';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { useDataTableController } from '../../components/use-data-table-controller';
import { Checkbox } from '../../components/ui/checkbox';
import { FilterResetButton } from '../../components/ui/filter-reset-button';
import { IconButton } from '../../components/ui/icon-button';
import { createEmptyNumberFilterState } from '../../components/ui/number-filter-state';
import { SelectionToolbar } from '../../components/ui/selection-toolbar';
import { Tooltip } from '../../components/ui/tooltip';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import {
  ENTITY_TABLE_MODE,
  ENTITY_TABLE_SIZE_LIMITS,
  TAG_COLUMN_IDS,
  TAG_COLUMN_SCHEMAS,
  entityVisibility,
  getEntityTableColumns,
  normalizeEntityOrder,
  toEntityFilterEntries,
} from './entity-table.config';
import { TagChip } from './tag-chip';
import { renderTagFilterPanel } from './tags-table-filter-panel';
import {
  createTagTableFilterState,
  isTagColumnFilterActive,
  isTagFilterDefault,
  matchesTagFilters,
  type TagTableFilterState,
} from './tags-table-filters';
import { TableLayoutDialogView } from './table-layout-dialog-view';
import type { CatalogPresenter } from './use-catalog-presenter';

/** A tag plus the number of trades it is currently assigned to. */
export type TagTableRow = TagDto & { readonly tradeCount: number };

interface TagsTableProps {
  readonly layout: TableLayoutDto | undefined;
  readonly presenter: CatalogPresenter;
  readonly quickCreate: ReactElement;
  readonly rows: readonly TagTableRow[];
}

export const TagsTable = ({
  layout,
  presenter,
  quickCreate,
  rows,
}: TagsTableProps): ReactElement => {
  const { t } = useTranslation();
  const [filterState, setFilterState] = useState<TagTableFilterState>(createTagTableFilterState);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<readonly string[] | null>(null);
  const [layoutColumns, setLayoutColumns] = useState<
    readonly { readonly id: string; readonly label: string; readonly visible: boolean }[]
  >([]);

  const isColumnFilterActive = (
    columnId: string,
    kind: DataTableColumnFilterSchema['kind'],
  ): boolean => isTagColumnFilterActive(filterState, columnId, kind);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        matchesTagFilters(row, filterState, { tradeCount: TAG_COLUMN_IDS.tradeCount }),
      ),
    [rows, filterState],
  );

  const columns = useMemo<readonly LegacyColumnDef<TagTableRow>[]>(
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
        id: TAG_COLUMN_IDS.selection,
        size: 48,
        cell: ({ row }) => (
          <Checkbox
            ariaLabel={t(TRANSLATION_KEYS.tableSelectRow)}
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked)}
          />
        ),
      },
      {
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <TagChip color={row.original.color} label={row.original.name} title={row.original.name} />
        ),
        header: t(TRANSLATION_KEYS.fieldTag),
        id: TAG_COLUMN_IDS.name,
      },
      {
        accessorFn: (row) => row.description,
        cell: ({ row }) =>
          row.original.description === ''
            ? t(TRANSLATION_KEYS.tableNotApplicable)
            : row.original.description,
        header: t(TRANSLATION_KEYS.fieldTagDescription),
        id: TAG_COLUMN_IDS.description,
      },
      {
        accessorFn: (row) => row.tradeCount,
        cell: ({ row }) => row.original.tradeCount,
        header: t(TRANSLATION_KEYS.fieldTagTradeCount),
        id: TAG_COLUMN_IDS.tradeCount,
      },
    ],
    [t],
  );

  const tableColumns = getEntityTableColumns('tags');
  const controller = useDataTableController({
    columns,
    data: filteredRows,
    defaultColumns: tableColumns,
    defaultMode: ENTITY_TABLE_MODE,
    getColumnsForMode: entityVisibility(tableColumns),
    getRowId: (row) => row.id,
    isDataColumn: (id) => id !== TAG_COLUMN_IDS.selection,
    layout,
    layoutId: 'tags',
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
    }
  };

  const filters: readonly DataTableColumnFilterViewModel[] = toEntityFilterEntries(
    TAG_COLUMN_SCHEMAS,
  ).map(({ columnId, schema }) => {
    const columnLabel = t(schema.labelKey as Parameters<typeof t>[0]);
    return {
      active: isColumnFilterActive(columnId, schema.kind),
      columnId,
      content: renderTagFilterPanel(columnId, schema, {
        columnLabel: () => columnLabel,
        filterState,
        onNumberChange: (id, bounds) =>
          setFilterState((current) => ({
            ...current,
            numberBounds: { ...current.numberBounds, [id]: bounds },
          })),
        onTextChange: (value) => setFilterState((current) => ({ ...current, textQuery: value })),
      }),
      expanded: controller.activeFilterColumnId === columnId,
      label: t(TRANSLATION_KEYS.tableFilterColumn, { column: columnLabel }),
      onOpenChange: (open) => controller.setActiveFilter(open ? columnId : null),
      onReset: () => resetColumnFilter(columnId, schema.kind),
      resetLabel,
    };
  });

  const selected = controller.selectedRows;
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
                onClick={() => selected[0] !== undefined && presenter.editTag(selected[0])}
                variant="edit"
              >
                <Pencil aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content={t(TRANSLATION_KEYS.actionDeleteSelected)}>
              <IconButton
                className={selected.length > 0 ? '' : 'is-hidden'}
                disabled={selected.length === 0}
                label={t(TRANSLATION_KEYS.actionDeleteSelected)}
                onClick={() => setPendingDeleteIds(selected.map((row) => row.id))}
                variant="danger"
              >
                <Trash2 aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <div className="table-toolbar-actions">
              <FilterResetButton
                label={t(TRANSLATION_KEYS.tableFilterResetAll)}
                onReset={() => setFilterState(createTagTableFilterState())}
                visible={!isTagFilterDefault(filterState)}
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
          rows.length === 0 ? TRANSLATION_KEYS.tagEmpty : TRANSLATION_KEYS.tableEmpty,
        )}
        filters={filters}
        onRowDoubleClick={(row) => presenter.editTag(row)}
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
          onToggleColumn={controller.toggleColumn}
          title={t(TRANSLATION_KEYS.tableLayout)}
        />
      )}
      {pendingDeleteIds !== null && (
        <ConfirmDialog
          cancelLabel={t(TRANSLATION_KEYS.actionCancel)}
          closeLabel={t(TRANSLATION_KEYS.actionClose)}
          confirmLabel={t(TRANSLATION_KEYS.actionDelete)}
          message={t(TRANSLATION_KEYS.tagDeleteConfirmation, { count: pendingDeleteIds.length })}
          onCancel={() => setPendingDeleteIds(null)}
          onConfirm={() => {
            const ids = pendingDeleteIds;
            setPendingDeleteIds(null);
            void presenter.deleteTags(ids).then((deleted) => {
              if (deleted) controller.clearSelection();
            });
          }}
          title={t(TRANSLATION_KEYS.actionDeleteSelected)}
        />
      )}
    </>
  );
};
