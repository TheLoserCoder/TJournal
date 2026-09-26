import {
  getFilteredRowModel,
  getSortedRowModel,
  useLegacyTable,
  type LegacyColumnDef,
  type LegacyReactTable,
} from '@tanstack/react-table/legacy';
import type {
  ColumnOrderState,
  OnChangeFn,
  RowData,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  TableColumnLayoutDto,
  TableDisplayMode,
  TableLayoutDto,
} from '../../shared/desktop-api';

type TableSizing = Record<string, number>;
type TableVisibility = Record<string, boolean>;

export interface DataTableColumnControl {
  readonly id: string;
  readonly label: string;
  readonly visible: boolean;
}

interface UseDataTableControllerOptions<TRow extends RowData> {
  readonly columns: readonly LegacyColumnDef<TRow>[];
  readonly data: readonly TRow[];
  readonly defaultColumns: readonly TableColumnLayoutDto[];
  readonly defaultMode: TableDisplayMode;
  readonly getColumnsForMode: (mode: TableDisplayMode) => TableVisibility;
  readonly getRowId: (row: TRow) => string;
  readonly isDataColumn: (id: string) => boolean;
  readonly layout: TableLayoutDto | undefined;
  readonly layoutId: TableLayoutDto['id'];
  readonly normalizeColumnOrder: (order: readonly string[] | undefined) => ColumnOrderState;
  readonly onLayoutChange: (layout: TableLayoutDto) => void;
  readonly onSortingChange?: OnChangeFn<SortingState>;
  readonly sizeLimits: { readonly minimum: number; readonly maximum: number };
  readonly sorting?: SortingState;
}

export interface DataTableController<TRow extends RowData> {
  readonly activeFilterColumnId: string | null;
  readonly columnControls: readonly DataTableColumnControl[];
  readonly mode: TableDisplayMode;
  readonly selectedRows: readonly TRow[];
  readonly table: LegacyReactTable<TRow>;
  applyLayout(
    mode: TableDisplayMode,
    columns: readonly { readonly id: string; readonly visible: boolean }[],
  ): void;
  clearSelection(): void;
  setActiveFilter(columnId: string | null): void;
  setMode(mode: TableDisplayMode): void;
  toggleColumn(id: string): void;
}

/**
 * Shared mechanical table state. Feature presenters retain filtering, labels and CRUD decisions.
 */
export const useDataTableController = <TRow extends RowData>({
  columns,
  data,
  defaultColumns,
  defaultMode,
  getColumnsForMode,
  getRowId,
  isDataColumn,
  layout,
  layoutId,
  normalizeColumnOrder,
  onLayoutChange,
  onSortingChange,
  sizeLimits,
  sorting,
}: UseDataTableControllerOptions<TRow>): DataTableController<TRow> => {
  const normalizeWidth = useCallback(
    (width: number): number => Math.min(sizeLimits.maximum, Math.max(sizeLimits.minimum, width)),
    [sizeLimits.maximum, sizeLimits.minimum],
  );
  // A saved layout predates columns added later, so the defaults fill the gaps:
  // a new column keeps its configured default visibility and width instead of
  // becoming visible (or zero-sized) because the stored map has no entry.
  const toSizing = useCallback(
    (items: readonly TableColumnLayoutDto[]): TableSizing => ({
      ...Object.fromEntries(
        defaultColumns.map((column) => [column.id, normalizeWidth(column.width)]),
      ),
      ...Object.fromEntries(items.map((column) => [column.id, normalizeWidth(column.width)])),
    }),
    [defaultColumns, normalizeWidth],
  );
  const toVisibility = useCallback(
    (items: readonly TableColumnLayoutDto[]): TableVisibility => ({
      ...Object.fromEntries(defaultColumns.map((column) => [column.id, column.visible])),
      ...Object.fromEntries(items.map((column) => [column.id, column.visible])),
    }),
    [defaultColumns],
  );
  const initialColumns = layout?.columns ?? defaultColumns;
  const layoutWasApplied = useRef(false);
  const [activeFilterColumnId, setActiveFilterColumnId] = useState<string | null>(null);
  const [columnSizing, setColumnSizing] = useState<TableSizing>(() => toSizing(initialColumns));
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() =>
    normalizeColumnOrder(layout?.order),
  );
  const [columnVisibility, setColumnVisibility] = useState<TableVisibility>(() =>
    toVisibility(initialColumns),
  );
  const [mode, setModeState] = useState<TableDisplayMode>(() => layout?.mode ?? defaultMode);
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const sortingState = sorting ?? internalSorting;
  const handleSortingChange: OnChangeFn<SortingState> = onSortingChange ?? setInternalSorting;

  useEffect(() => {
    if (layoutWasApplied.current || layout === undefined) return;
    layoutWasApplied.current = true;
    setColumnSizing(toSizing(layout.columns));
    setColumnOrder(normalizeColumnOrder(layout.order));
    setColumnVisibility(toVisibility(layout.columns));
    setModeState(layout.mode);
  }, [layout, normalizeColumnOrder, toSizing, toVisibility]);

  useEffect(() => {
    setRowSelection((current) => (Object.keys(current).length === 0 ? current : {}));
  }, [data]);

  const persistLayout = useCallback(
    (
      nextMode: TableDisplayMode,
      nextOrder: ColumnOrderState,
      nextVisibility: TableVisibility,
      nextSizing: TableSizing,
    ): void => {
      onLayoutChange({
        columns: defaultColumns.map((column) => ({
          id: column.id,
          visible: nextVisibility[column.id] ?? column.visible,
          width: normalizeWidth(nextSizing[column.id] ?? column.width),
        })),
        id: layoutId,
        mode: nextMode,
        order: nextOrder,
      });
    },
    [defaultColumns, layoutId, normalizeWidth, onLayoutChange],
  );
  const setMode = useCallback(
    (nextMode: TableDisplayMode): void => {
      const nextVisibility = getColumnsForMode(nextMode);
      setModeState(nextMode);
      setColumnVisibility(nextVisibility);
      setActiveFilterColumnId(null);
      persistLayout(nextMode, columnOrder, nextVisibility, columnSizing);
    },
    [columnOrder, columnSizing, getColumnsForMode, persistLayout],
  );
  const applyLayout = useCallback(
    (
      nextMode: TableDisplayMode,
      nextColumns: readonly { readonly id: string; readonly visible: boolean }[],
    ): void => {
      const nextVisibility = Object.fromEntries(
        nextColumns.map((column) => [column.id, column.visible]),
      );
      setModeState(nextMode);
      setColumnVisibility(nextVisibility);
      setActiveFilterColumnId(null);
      persistLayout(nextMode, columnOrder, nextVisibility, columnSizing);
    },
    [columnOrder, columnSizing, persistLayout],
  );
  const toggleColumn = useCallback(
    (columnId: string): void => {
      if (!isDataColumn(columnId)) return;
      setColumnVisibility((current) => {
        const next = { ...current, [columnId]: !current[columnId] };
        persistLayout(mode, columnOrder, next, columnSizing);
        return next;
      });
    },
    [columnOrder, columnSizing, isDataColumn, mode, persistLayout],
  );
  const table = useLegacyTable({
    columns,
    data,
    defaultColumn: { maxSize: sizeLimits.maximum, minSize: sizeLimits.minimum },
    enableColumnResizing: true,
    enableRowSelection: true,
    getFilteredRowModel: getFilteredRowModel(),
    getRowId,
    getSortedRowModel: getSortedRowModel(),
    onColumnOrderChange: (update) =>
      setColumnOrder((current) => {
        const next = typeof update === 'function' ? update(current) : update;
        const normalized = normalizeColumnOrder(next);
        persistLayout(mode, normalized, columnVisibility, columnSizing);
        return normalized;
      }),
    onColumnSizingChange: (update) =>
      setColumnSizing((current) => {
        const next = typeof update === 'function' ? update(current) : update;
        persistLayout(mode, columnOrder, columnVisibility, next);
        return next;
      }),
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    state: { columnOrder, columnSizing, columnVisibility, rowSelection, sorting: sortingState },
  });
  const columnControls = columns
    .filter((column) => column.id !== undefined && isDataColumn(column.id))
    .map((column) => ({
      id: column.id ?? '',
      label: typeof column.header === 'string' ? column.header : (column.id ?? ''),
      visible: columnVisibility[column.id ?? ''] ?? true,
    }));
  return {
    activeFilterColumnId,
    applyLayout,
    clearSelection: () => setRowSelection({}),
    columnControls,
    mode,
    setActiveFilter: setActiveFilterColumnId,
    selectedRows: table.getSelectedRowModel().rows.map((row) => row.original),
    setMode,
    table,
    toggleColumn,
  };
};
