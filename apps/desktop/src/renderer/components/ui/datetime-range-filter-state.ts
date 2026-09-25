/**
 * Datetime range filter state contract. Kept out of the panel component module
 * so filter reducers can depend on the shape without React, and so the panel
 * file exports only components for React Fast Refresh.
 */

export interface DateTimeRangeFilterState {
  readonly from: string;
  readonly fromTime: string;
  readonly to: string;
  readonly toTime: string;
}

export const createEmptyDateTimeRangeFilterState = (): DateTimeRangeFilterState => ({
  from: '',
  fromTime: '',
  to: '',
  toTime: '',
});

export const isDateTimeRangeFilterStateDefault = (state: DateTimeRangeFilterState): boolean =>
  state.from === '' && state.to === '';
