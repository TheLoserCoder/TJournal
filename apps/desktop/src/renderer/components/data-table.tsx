import { flexRender, type RowData } from '@tanstack/react-table';
import { type LegacyReactTable } from '@tanstack/react-table/legacy';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ArrowUpDown, Funnel, RotateCcw } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';

import { IconButton } from './ui/icon-button';
import { Popover } from './ui/popover';
import { Tooltip } from './ui/tooltip';

export interface DataTableColumnFilterViewModel {
  readonly active: boolean;
  readonly columnId: string;
  readonly content: ReactNode;
  readonly expanded: boolean;
  readonly label: string;
  readonly resetLabel: string;
  onOpenChange(open: boolean): void;
  onReset(): void;
}

export interface DataTableVirtualization {
  readonly hasMore: boolean;
  readonly hasPrevious: boolean;
  readonly loadingLabel: string;
  readonly loading: boolean;
  readonly onLoadMore: () => void;
  readonly onLoadPrevious: () => void;
  readonly rowHeight: number;
  readonly rowStartIndex: number;
  readonly totalRowCount: number;
}

interface DataTableProps<TRow extends RowData> {
  readonly emptyMessage: string;
  readonly filters: readonly DataTableColumnFilterViewModel[];
  /** Opens the feature-owned editor for the double-clicked row. */
  readonly onRowDoubleClick?: (row: TRow) => void;
  readonly resizeColumnLabel: string;
  /** Localized accessible name of the horizontally scrollable table region. */
  readonly scrollRegionLabel: string;
  readonly sortColumnLabel: string;
  readonly table: LegacyReactTable<TRow>;
  /**
   * Enables fixed-height windowing with incremental loading. Feature tables
   * that fit in memory can omit it and render every row.
   */
  readonly virtualization?: DataTableVirtualization;
}

const FALLBACK_WINDOW_SIZE = 30;

const SortIndicator = ({
  direction,
}: {
  readonly direction: false | 'asc' | 'desc';
}): ReactElement =>
  direction === 'asc' ? (
    <ArrowUp aria-hidden="true" />
  ) : direction === 'desc' ? (
    <ArrowDown aria-hidden="true" />
  ) : (
    <ArrowUpDown aria-hidden="true" />
  );

export const DataTable = <TRow extends RowData>({
  emptyMessage,
  filters,
  onRowDoubleClick,
  resizeColumnLabel,
  scrollRegionLabel,
  sortColumnLabel,
  table,
  virtualization,
}: DataTableProps<TRow>): ReactElement => {
  const rows = table.getRowModel().rows;
  const tableWidth = table.getTotalSize();
  const [resizingColumnId, setResizingColumnId] = useState<string | null>(null);
  const [resizeGuideX, setResizeGuideX] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: virtualization?.totalRowCount ?? 0,
    estimateSize: () => virtualization?.rowHeight ?? 0,
    getScrollElement: () => scrollRef.current,
    overscan: 12,
  });
  const virtualRows = virtualizer.getVirtualItems();
  // Before the scroll container is measured (first paint, jsdom) the virtualizer
  // reports nothing; render a bounded first window so the table is never blank.
  const windowedRows = useMemo(
    () =>
      virtualization === undefined
        ? []
        : virtualRows.length > 0
          ? virtualRows
          : rows.slice(0, FALLBACK_WINDOW_SIZE).map((_row, localIndex) => {
              const index = virtualization.rowStartIndex + localIndex;
              return {
                end: (index + 1) * virtualization.rowHeight,
                index,
                start: index * virtualization.rowHeight,
              };
            }),
    [rows, virtualRows, virtualization],
  );
  const virtualTotalSize =
    virtualization === undefined
      ? 0
      : virtualRows.length > 0
        ? virtualizer.getTotalSize()
        : virtualization.totalRowCount * virtualization.rowHeight;
  const renderRow = (row: (typeof rows)[number]): ReactElement => (
    <tr
      aria-selected={row.getIsSelected()}
      data-state={row.getIsSelected() ? 'selected' : undefined}
      key={row.id}
      onDoubleClick={
        onRowDoubleClick === undefined ? undefined : () => onRowDoubleClick(row.original)
      }
    >
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} style={{ width: cell.column.getSize() }}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
  useEffect(() => {
    if (virtualization === undefined || !virtualization.hasMore || virtualization.loading) {
      return;
    }
    const lastVirtualRow = windowedRows[windowedRows.length - 1];
    if (lastVirtualRow === undefined) return;
    const loadedEndIndex = virtualization.rowStartIndex + rows.length;
    if (lastVirtualRow.index >= loadedEndIndex - 8) virtualization.onLoadMore();
  }, [rows.length, virtualization, windowedRows]);
  useEffect(() => {
    if (virtualization === undefined || !virtualization.hasPrevious || virtualization.loading) {
      return;
    }
    const firstVirtualRow = windowedRows[0];
    if (firstVirtualRow === undefined) return;
    if (firstVirtualRow.index <= virtualization.rowStartIndex + 8) {
      virtualization.onLoadPrevious();
    }
  }, [virtualization, windowedRows]);
  useEffect(() => {
    const updateResizeGuide = (event: MouseEvent): void => {
      const scrollElement = scrollRef.current;
      if (resizingColumnId === null || scrollElement === null) return;
      const bounds = scrollElement.getBoundingClientRect();
      setResizeGuideX(event.clientX - bounds.left + scrollElement.scrollLeft);
    };
    const clearResizingColumn = (): void => setResizingColumnId(null);
    window.addEventListener('mousemove', updateResizeGuide);
    window.addEventListener('mouseup', clearResizingColumn);
    return () => {
      window.removeEventListener('mousemove', updateResizeGuide);
      window.removeEventListener('mouseup', clearResizingColumn);
    };
  }, [resizingColumnId]);
  const resizeGuideStyle =
    resizingColumnId === null
      ? undefined
      : ({ '--resize-guide-x': `${resizeGuideX}px` } as CSSProperties);

  return (
    <div
      aria-label={scrollRegionLabel}
      className="data-table-scroll"
      data-empty={rows.length === 0 ? 'true' : 'false'}
      data-resizing={resizingColumnId === null ? 'false' : 'true'}
      ref={scrollRef}
      role="region"
      style={resizeGuideStyle}
      tabIndex={0}
    >
      <table className="data-table" style={{ minWidth: '100%', width: tableWidth }}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const filter = filters.find((item) => item.columnId === header.column.id);
                const sortDirection = header.column.getIsSorted();
                return (
                  <th key={header.id} style={{ width: header.getSize() }}>
                    {header.isPlaceholder ? null : (
                      <div className="data-table-header">
                        {header.column.getCanSort() ? (
                          <button
                            aria-label={sortColumnLabel}
                            className="table-sort-button"
                            onClick={header.column.getToggleSortingHandler()}
                            type="button"
                          >
                            <span>
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </span>
                            <SortIndicator direction={sortDirection} />
                          </button>
                        ) : (
                          <div className="table-text">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </div>
                        )}
                        {filter !== undefined && (
                          <div className="data-table-header-actions">
                            {filter.active && (
                              <Tooltip content={filter.resetLabel}>
                                <IconButton
                                  className="column-reset-button"
                                  label={filter.resetLabel}
                                  onClick={filter.onReset}
                                >
                                  <RotateCcw aria-hidden="true" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Popover
                              onOpenChange={filter.onOpenChange}
                              open={filter.expanded}
                              trigger={
                                <IconButton
                                  className={
                                    filter.active
                                      ? 'column-filter-button active'
                                      : 'column-filter-button'
                                  }
                                  label={filter.label}
                                >
                                  <Funnel aria-hidden="true" />
                                </IconButton>
                              }
                            >
                              {filter.content}
                            </Popover>
                          </div>
                        )}
                        {header.column.getCanResize() && (
                          <button
                            aria-label={resizeColumnLabel}
                            className="column-resize-handle"
                            onDoubleClick={() => header.column.resetSize()}
                            onMouseDown={(event) => {
                              setResizingColumnId(header.column.id);
                              const scrollElement = scrollRef.current;
                              if (scrollElement !== null) {
                                const bounds = scrollElement.getBoundingClientRect();
                                setResizeGuideX(
                                  event.clientX - bounds.left + scrollElement.scrollLeft,
                                );
                              }
                              header.getResizeHandler()(event);
                            }}
                            type="button"
                          />
                        )}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {virtualization === undefined ? (
            rows.map(renderRow)
          ) : (
            <>
              <tr aria-hidden="true" style={{ height: `${windowedRows[0]?.start ?? 0}px` }} />
              {windowedRows.map((virtualRow) => {
                const row = rows[virtualRow.index - virtualization.rowStartIndex];
                return row === undefined ? null : renderRow(row);
              })}
              {virtualization.loading && (
                <tr className="data-table-loading-row">
                  <td colSpan={table.getVisibleLeafColumns().length}>
                    {virtualization.loadingLabel}
                  </td>
                </tr>
              )}
              <tr
                aria-hidden="true"
                style={{
                  height: `${Math.max(0, virtualTotalSize - (windowedRows[windowedRows.length - 1]?.end ?? 0))}px`,
                }}
              />
            </>
          )}
        </tbody>
      </table>
      {/* Rendered outside the table: a wide table would otherwise centre the
          message inside its full scroll width instead of the visible area. */}
      {rows.length === 0 ? <p className="data-table-empty-state">{emptyMessage}</p> : null}
    </div>
  );
};
