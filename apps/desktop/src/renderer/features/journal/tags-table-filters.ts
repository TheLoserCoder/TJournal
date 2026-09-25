import type { DataTableColumnFilterSchema } from '../../components/data-table-filter';
import {
  createEmptyNumberFilterState,
  isNumberFilterStateDefault,
  type NumberFilterState,
} from '../../components/ui/number-filter-state';
import { matchesBounds } from './trade-table-filters';

export interface TagTableFilterState {
  readonly numberBounds: Readonly<Record<string, NumberFilterState>>;
  /** Shared substring used by the name and comment text filters. */
  readonly textQuery: string;
}

export const createTagTableFilterState = (): TagTableFilterState => ({
  numberBounds: {},
  textQuery: '',
});

export const getTagNumberBounds = (
  state: TagTableFilterState,
  columnId: string,
): NumberFilterState => state.numberBounds[columnId] ?? createEmptyNumberFilterState();

export const isTagFilterDefault = (state: TagTableFilterState): boolean =>
  state.textQuery.trim() === '' &&
  Object.values(state.numberBounds).every(isNumberFilterStateDefault);

export const isTagColumnFilterActive = (
  state: TagTableFilterState,
  columnId: string,
  kind: DataTableColumnFilterSchema['kind'],
): boolean => {
  if (kind === 'text') return state.textQuery.trim() !== '';
  if (kind === 'number') return !isNumberFilterStateDefault(getTagNumberBounds(state, columnId));
  return false;
};

export const matchesTagFilters = (
  row: {
    readonly description: string;
    readonly name: string;
    readonly tradeCount: number;
  },
  state: TagTableFilterState,
  columns: { readonly tradeCount?: string },
): boolean => {
  if (state.textQuery.trim() !== '') {
    const query = state.textQuery.trim().toLocaleUpperCase();
    const values = [row.name, row.description].map((value) => value.toLocaleUpperCase());
    if (!values.some((value) => value.includes(query))) return false;
  }
  if (columns.tradeCount !== undefined) {
    const bounds = state.numberBounds[columns.tradeCount];
    if (bounds !== undefined && !isNumberFilterStateDefault(bounds)) {
      if (!matchesBounds(String(row.tradeCount), bounds)) return false;
    }
  }
  return true;
};
