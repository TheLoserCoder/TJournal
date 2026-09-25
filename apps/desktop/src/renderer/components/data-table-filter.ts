/**
 * Column filter kinds understood by the neutral DataTable layer. The concrete
 * predicate always lives in the feature presenter; this type only describes the
 * editing surface a column offers.
 *
 * `none` is reserved for mechanical columns (for example row selection) that
 * cannot be filtered and therefore deliberately opt out.
 */
export interface DataTableTextFilterSchema {
  readonly kind: 'text';
}

export interface DataTableNumberFilterSchema {
  readonly kind: 'number';
  readonly unitLabel?: string;
}

export interface DataTableDateRangeFilterSchema {
  readonly kind: 'date-range';
}

export interface DataTableDateTimeRangeFilterSchema {
  readonly kind: 'datetime-range';
}

export interface DataTableMultiSelectFilterSchema {
  readonly kind: 'multi-select';
}

export interface DataTableNoFilterSchema {
  readonly kind: 'none';
}

export type DataTableColumnFilterSchema =
  | DataTableTextFilterSchema
  | DataTableNumberFilterSchema
  | DataTableDateRangeFilterSchema
  | DataTableDateTimeRangeFilterSchema
  | DataTableMultiSelectFilterSchema
  | DataTableNoFilterSchema;
