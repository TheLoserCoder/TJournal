import { flexRender, type RowData } from '@tanstack/react-table';
import { type LegacyReactTable } from '@tanstack/react-table/legacy';
import { ArrowDown, ArrowUp, ArrowUpDown, Funnel } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';

import { IconButton } from './ui/icon-button';
import { Popover } from './ui/popover';

export interface DataTableColumnFilterViewModel {
  readonly active: boolean;
  readonly columnId: string;
  readonly content: ReactNode;
  readonly expanded: boolean;
  readonly label: string;
  readonly onOpenChange: (open: boolean) => void;
}

interface DataTableProps<TRow extends RowData> {
  readonly emptyMessage: string;
  readonly filters: readonly DataTableColumnFilterViewModel[];
  readonly resizeColumnLabel: string;
  readonly sortColumnLabel: string;
  readonly table: LegacyReactTable<TRow>;
}

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
  resizeColumnLabel,
  sortColumnLabel,
  table,
}: DataTableProps<TRow>): ReactElement => {
  const rows = table.getRowModel().rows;
  const [resizingColumnId, setResizingColumnId] = useState<string | null>(null);
  const [resizeGuideX, setResizeGuideX] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
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
      className="data-table-scroll"
      data-empty={rows.length === 0 ? 'true' : 'false'}
      data-resizing={resizingColumnId === null ? 'false' : 'true'}
      ref={scrollRef}
      style={resizeGuideStyle}
    >
      <table className="data-table">
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
          {rows.length === 0 ? (
            <tr>
              <td className="data-table-empty" colSpan={table.getVisibleLeafColumns().length}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                aria-selected={row.getIsSelected()}
                data-state={row.getIsSelected() ? 'selected' : undefined}
                key={row.id}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={{ width: cell.column.getSize() }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
