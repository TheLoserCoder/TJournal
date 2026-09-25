import type { ReactElement } from 'react';

import type { DataTableColumnFilterSchema } from '../../components/data-table-filter';
import { NumberFilterPanel } from '../../components/ui/number-filter-panel';
import type { NumberFilterState } from '../../components/ui/number-filter-state';
import { TextFilterPanel } from '../../components/ui/text-filter-panel';
import { getTagNumberBounds, type TagTableFilterState } from './tags-table-filters';

export interface TagFilterPanelContext {
  readonly columnLabel: (columnId: string) => string;
  readonly filterState: TagTableFilterState;
  readonly onNumberChange: (columnId: string, bounds: NumberFilterState) => void;
  readonly onTextChange: (value: string) => void;
}

/** Filter surfaces of the tag catalogue, which only uses text and number columns. */
export const renderTagFilterPanel = (
  columnId: string,
  schema: DataTableColumnFilterSchema,
  context: TagFilterPanelContext,
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
          state={getTagNumberBounds(context.filterState, columnId)}
        />
      );
    default:
      return null;
  }
};
