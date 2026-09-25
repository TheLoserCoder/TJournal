/**
 * Numeric filter state contract. It deliberately lives outside the panel
 * component module: feature filter reducers depend on this shape without
 * pulling in React, and the panel file keeps exporting only components so
 * React Fast Refresh stays enabled for it.
 */

export const NUMBER_FILTER_MODES = {
  between: 'between',
  equals: 'equals',
  greaterThan: 'greater-than',
  lessThan: 'less-than',
} as const;

export type NumberFilterMode = (typeof NUMBER_FILTER_MODES)[keyof typeof NUMBER_FILTER_MODES];

export interface NumberFilterState {
  readonly maximum: string;
  readonly minimum: string;
  readonly mode: NumberFilterMode;
}

export const createEmptyNumberFilterState = (): NumberFilterState => ({
  maximum: '',
  minimum: '',
  mode: NUMBER_FILTER_MODES.greaterThan,
});

export const isNumberFilterStateDefault = (state: NumberFilterState): boolean =>
  state.minimum.trim() === '' && state.maximum.trim() === '';
