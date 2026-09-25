import { useLegacyTable, type LegacyColumnDef } from '@tanstack/react-table/legacy';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTable, type DataTableColumnFilterViewModel } from './data-table';

interface TestRow {
  readonly id: string;
  readonly name: string;
}

const COLUMNS: readonly LegacyColumnDef<TestRow>[] = [
  { accessorKey: 'name', header: 'Name', id: 'name', size: 240 },
  { accessorKey: 'id', header: 'Identifier', id: 'identifier', size: 160 },
];
const SCROLL_REGION_LABEL = 'Scrollable table';
const VIRTUAL_ROW_HEIGHT = 40;

const DataTableHarness = ({
  onRowDoubleClick,
  rows,
}: {
  readonly onRowDoubleClick?: (row: TestRow) => void;
  readonly rows: readonly TestRow[];
}): ReactElement => {
  const table = useLegacyTable({
    columns: COLUMNS,
    data: rows,
    getRowId: (row) => row.id,
  });
  return (
    <DataTable
      emptyMessage="Nothing here"
      filters={[]}
      onRowDoubleClick={onRowDoubleClick}
      resizeColumnLabel="Resize column"
      scrollRegionLabel={SCROLL_REGION_LABEL}
      sortColumnLabel="Sort column"
      table={table}
    />
  );
};

const FilterHarness = ({
  active,
  onReset,
}: {
  readonly active: boolean;
  readonly onReset: () => void;
}): ReactElement => {
  const table = useLegacyTable({
    columns: COLUMNS,
    data: [],
    getRowId: (row) => row.id,
  });
  const filters: readonly DataTableColumnFilterViewModel[] = [
    {
      active,
      columnId: 'name',
      content: <div>panel</div>,
      expanded: false,
      label: 'Filter Name',
      onOpenChange: () => {},
      onReset,
      resetLabel: 'Reset Name filter',
    },
  ];
  return (
    <DataTable
      emptyMessage="Nothing here"
      filters={filters}
      resizeColumnLabel="Resize column"
      scrollRegionLabel={SCROLL_REGION_LABEL}
      sortColumnLabel="Sort column"
      table={table}
    />
  );
};

const VirtualizedDataTableHarness = ({
  rowStartIndex,
  rows,
}: {
  readonly rowStartIndex: number;
  readonly rows: readonly TestRow[];
}): ReactElement => {
  const table = useLegacyTable({
    columns: COLUMNS,
    data: rows,
    getRowId: (row) => row.id,
  });
  return (
    <DataTable
      emptyMessage="Nothing here"
      filters={[]}
      resizeColumnLabel="Resize column"
      scrollRegionLabel={SCROLL_REGION_LABEL}
      sortColumnLabel="Sort column"
      table={table}
      virtualization={{
        hasMore: false,
        hasPrevious: rowStartIndex > 0,
        loadingLabel: 'Loading',
        loading: true,
        onLoadMore: () => {},
        onLoadPrevious: () => {},
        rowHeight: VIRTUAL_ROW_HEIGHT,
        rowStartIndex,
        totalRowCount: rowStartIndex + rows.length,
      }}
    />
  );
};

describe('DataTable', () => {
  afterEach(() => {
    cleanup();
  });

  it('sizes the table from the TanStack column sizes so columns are never squeezed', () => {
    render(<DataTableHarness rows={[]} />);

    expect(screen.getByRole('table')).toHaveStyle({ minWidth: '100%', width: '400px' });
  });

  it('exposes a keyboard-focusable scroll region with a localized name', () => {
    render(<DataTableHarness rows={[{ id: 'row-1', name: 'First' }]} />);

    const region = screen.getByRole('region', { name: SCROLL_REGION_LABEL });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveClass('data-table-scroll');
    expect(region).toHaveAttribute('data-empty', 'false');
  });

  it('keeps the empty state inside the same scroll region, outside the table', () => {
    render(<DataTableHarness rows={[]} />);

    const region = screen.getByRole('region', { name: SCROLL_REGION_LABEL });
    expect(region).toHaveAttribute('data-empty', 'true');
    const message = screen.getByText('Nothing here');
    expect(region).toContainElement(message);
    // A sibling of the table centres inside the visible scroll area instead of
    // the full scroll width of a wide table.
    expect(message.closest('table')).toBeNull();
    expect(message).toHaveClass('data-table-empty-state');
  });

  it('keeps the scroll region as the single root so the table can stretch', () => {
    render(<DataTableHarness rows={[{ id: 'row-1', name: 'First' }]} />);

    const region = screen.getByRole('region', { name: SCROLL_REGION_LABEL });
    expect(region.closest('.data-table-frame')).toBeNull();
    expect(document.querySelector('.data-table-toolbar')).toBeNull();
  });

  it('shows the header reset only while the column filter is applied', () => {
    const { rerender } = render(<FilterHarness active={false} onReset={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Reset Name filter' })).not.toBeInTheDocument();

    rerender(<FilterHarness active onReset={() => {}} />);
    expect(screen.getByRole('button', { name: 'Reset Name filter' })).toBeVisible();
  });

  it('resets the column filter through the header action', () => {
    const onReset = vi.fn();
    render(<FilterHarness active onReset={onReset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reset Name filter' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('reports the double-clicked row through the feature callback', () => {
    const onRowDoubleClick = vi.fn();
    render(
      <DataTableHarness
        onRowDoubleClick={onRowDoubleClick}
        rows={[{ id: 'row-1', name: 'First' }]}
      />,
    );

    fireEvent.doubleClick(screen.getByText('First'));
    expect(onRowDoubleClick).toHaveBeenCalledWith({ id: 'row-1', name: 'First' });
  });

  it('preserves absolute scroll geometry for a retained row window', () => {
    const { container } = render(
      <VirtualizedDataTableHarness
        rowStartIndex={100}
        rows={[{ id: 'row-101', name: 'Retained row' }]}
      />,
    );

    expect(screen.getByText('Retained row')).toBeVisible();
    expect(container.querySelector('tbody tr[aria-hidden="true"]')).toHaveStyle({
      height: `${100 * VIRTUAL_ROW_HEIGHT}px`,
    });
  });
});
