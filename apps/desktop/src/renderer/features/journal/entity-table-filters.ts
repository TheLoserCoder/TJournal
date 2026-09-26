import {
  createEmptyNumberFilterState,
  isNumberFilterStateDefault,
  type NumberFilterState,
} from '../../components/ui/number-filter-state';
import type { DataTableColumnFilterSchema } from '../../components/data-table-filter';
import { matchesBounds } from './trade-table-filters';

export interface EntityTableFilterState {
  /** Selected closed-set values (`active`, `archived`, categories, ...). */
  readonly categories: readonly string[];
  readonly numberBounds: Readonly<Record<string, NumberFilterState>>;
  readonly statuses: readonly string[];
  readonly textQuery: string;
}

export const createEntityTableFilterState = (
  statusDefaults: readonly string[],
): EntityTableFilterState => ({
  categories: [],
  numberBounds: {},
  statuses: statusDefaults,
  textQuery: '',
});

export const getEntityNumberBounds = (
  state: EntityTableFilterState,
  columnId: string,
): NumberFilterState => state.numberBounds[columnId] ?? createEmptyNumberFilterState();

export const isEntityFilterDefault = (state: EntityTableFilterState): boolean =>
  (state.statuses.length === 0
    ? true
    : state.statuses.length === 1 && state.statuses[0] === 'active') &&
  state.textQuery.trim() === '' &&
  state.categories.length === 0 &&
  Object.values(state.numberBounds).every(isNumberFilterStateDefault);

/**
 * Per-column highlight: one applied filter never marks every header button.
 * The status column also treats "no status selected" as active because it
 * differs from the table's default `active`-only view.
 */
export const isEntityColumnFilterActive = (
  state: EntityTableFilterState,
  columnId: string,
  kind: DataTableColumnFilterSchema['kind'],
  statusColumnId: string,
): boolean => {
  if (kind === 'text') return state.textQuery.trim() !== '';
  if (kind === 'number') return !isNumberFilterStateDefault(getEntityNumberBounds(state, columnId));
  if (kind === 'multi-select') {
    return columnId === statusColumnId
      ? state.statuses.length !== 1 || state.statuses[0] !== 'active'
      : state.categories.length > 0;
  }
  return false;
};

export const matchesEntityFilters = (
  row: {
    readonly archivedAt: string | null;
    readonly category?: string;
    readonly name?: string;
    readonly openingBalanceUsd?: string;
    readonly currentKnownBalanceUsd?: string;
    readonly symbol?: string;
  },
  state: EntityTableFilterState,
  columns: {
    readonly balance?: string;
    readonly opening?: string;
    readonly text?: readonly string[];
  },
): boolean => {
  if (state.textQuery.trim() !== '') {
    const query = state.textQuery.trim().toLocaleUpperCase();
    const values = (columns.text ?? []).map((value) => value.toLocaleUpperCase());
    if (!values.some((value) => value.includes(query))) return false;
  }
  if (state.statuses.length > 0) {
    const status = row.archivedAt === null ? 'active' : 'archived';
    if (!state.statuses.includes(status)) return false;
  }
  if (state.categories.length > 0) {
    if (row.category === undefined || !state.categories.includes(row.category)) return false;
  }
  if (state.numberBounds === undefined) return true;
  const numericColumns: readonly (readonly [string | undefined, string | undefined])[] = [
    [columns.opening, row.openingBalanceUsd],
    [columns.balance, row.currentKnownBalanceUsd],
  ];
  for (const [columnId, value] of numericColumns) {
    if (columnId === undefined) continue;
    const bounds = state.numberBounds[columnId];
    if (bounds === undefined || isNumberFilterStateDefault(bounds)) continue;
    if (value === undefined) return false;
    if (!matchesBounds(value, bounds)) return false;
  }
  return true;
};
