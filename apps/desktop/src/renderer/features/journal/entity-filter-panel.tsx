import type { ReactElement } from 'react';

import type { DataTableColumnFilterSchema } from '../../components/data-table-filter';
import { CheckboxListPanel } from '../../components/ui/multi-select';
import { getEntityNumberBounds, type EntityTableFilterState } from './entity-table-filters';
import { NumberFilterPanel } from '../../components/ui/number-filter-panel';
import type { NumberFilterState } from '../../components/ui/number-filter-state';
import { TextFilterPanel } from '../../components/ui/text-filter-panel';

interface EntityFilterPanelContext {
  readonly categoryOptions: readonly { readonly id: string; readonly label: string }[];
  readonly columnLabel: (columnId: string) => string;
  readonly filterState: EntityTableFilterState;
  readonly onCategoryChange: (values: readonly string[]) => void;
  readonly onNumberChange: (columnId: string, bounds: NumberFilterState) => void;
  readonly onStatusChange: (values: readonly string[]) => void;
  readonly onTextChange: (value: string) => void;
  readonly statusOptions: readonly { readonly id: string; readonly label: string }[];
}

/**
 * Renders the declared filter surface of one Accounts/Assets column. Both
 * tables share this factory, so a new column cannot invent a different
 * filtering interaction.
 */
export const renderEntityFilterPanel = (
  columnId: string,
  schema: DataTableColumnFilterSchema & { readonly unit?: string },
  context: EntityFilterPanelContext,
): ReactElement | null => {
  switch (schema.kind) {
    case 'text':
      return (
        <TextFilterPanel
          label={context.columnLabel(columnId)}
          onChange={(state) => context.onTextChange(state.value)}
          state={{ value: context.filterState.textQuery }}
        />
      );
    case 'number':
      return (
        <NumberFilterPanel
          label={context.columnLabel(columnId)}
          onChange={(bounds) => context.onNumberChange(columnId, bounds)}
          state={getEntityNumberBounds(context.filterState, columnId)}
          unit={schema.unit}
        />
      );
    case 'multi-select':
      return (
        <CheckboxListPanel
          onSelectedIdsChange={
            columnId === 'category' ? context.onCategoryChange : context.onStatusChange
          }
          options={columnId === 'category' ? context.categoryOptions : context.statusOptions}
          searchLabel={context.columnLabel(columnId)}
          selectedIds={
            columnId === 'category' ? context.filterState.categories : context.filterState.statuses
          }
        />
      );
    case 'date-range':
    case 'datetime-range':
    case 'none':
      return null;
    default:
      return null;
  }
};
