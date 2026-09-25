import { describe, expect, it } from 'vitest';

import { NUMBER_FILTER_MODES } from '../../components/ui/number-filter-state';
import {
  createTagTableFilterState,
  isTagColumnFilterActive,
  isTagFilterDefault,
  matchesTagFilters,
  type TagTableFilterState,
} from './tags-table-filters';

const row = (name: string, description: string, tradeCount: number) => ({
  description,
  name,
  tradeCount,
});

const withFilters = (patch: Partial<TagTableFilterState>): TagTableFilterState => ({
  ...createTagTableFilterState(),
  ...patch,
});

describe('tag table filters', () => {
  it('matches name and comment case-insensitively', () => {
    expect(
      matchesTagFilters(row('Breakout', 'Trend day', 3), withFilters({ textQuery: 'break' }), {}),
    ).toBe(true);
    expect(
      matchesTagFilters(row('Breakout', 'Trend day', 3), withFilters({ textQuery: 'TREND' }), {}),
    ).toBe(true);
    expect(
      matchesTagFilters(row('Breakout', 'Trend day', 3), withFilters({ textQuery: 'news' }), {}),
    ).toBe(false);
  });

  it('applies inclusive numeric bounds to the trade count', () => {
    const state = withFilters({
      numberBounds: {
        tradeCount: {
          maximum: '5',
          minimum: '2',
          mode: NUMBER_FILTER_MODES.between,
        },
      },
    });
    expect(matchesTagFilters(row('A', '', 3), state, { tradeCount: 'tradeCount' })).toBe(true);
    expect(matchesTagFilters(row('B', '', 8), state, { tradeCount: 'tradeCount' })).toBe(false);
  });

  it('tracks applied and default filters per column', () => {
    const state = withFilters({ textQuery: 'x' });
    expect(isTagFilterDefault(createTagTableFilterState())).toBe(true);
    expect(isTagFilterDefault(state)).toBe(false);
    expect(isTagColumnFilterActive(state, 'name', 'text')).toBe(true);
    expect(isTagColumnFilterActive(state, 'tradeCount', 'number')).toBe(false);
  });
});
