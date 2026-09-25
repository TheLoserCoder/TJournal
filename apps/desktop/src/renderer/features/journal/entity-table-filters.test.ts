import { describe, expect, it } from 'vitest';

import {
  NUMBER_FILTER_MODES,
  type NumberFilterState,
} from '../../components/ui/number-filter-state';
import {
  createEntityTableFilterState,
  getEntityNumberBounds,
  isEntityColumnFilterActive,
  isEntityFilterDefault,
  matchesEntityFilters,
} from './entity-table-filters';

const account = (
  overrides: {
    readonly archivedAt?: string | null;
    readonly currentKnownBalanceUsd?: string;
    readonly name?: string;
    readonly openingBalanceUsd?: string;
  } = {},
) => ({
  archivedAt: null,
  currentKnownBalanceUsd: '1000',
  name: 'Main',
  openingBalanceUsd: '500',
  ...overrides,
});

const asset = (
  overrides: {
    readonly archivedAt?: string | null;
    readonly category?: string;
    readonly symbol?: string;
    readonly tickSize?: string;
    readonly tickValueUsdPerLot?: string;
  } = {},
) => ({
  archivedAt: null,
  category: 'forex',
  calculationProfile:
    overrides.tickSize === undefined && overrides.tickValueUsdPerLot === undefined
      ? null
      : {
          tickSize: overrides.tickSize ?? '0.0001',
          tickValueUsdPerLot: overrides.tickValueUsdPerLot ?? '10',
        },
  symbol: 'EURUSD',
  ...overrides,
});

const bounds = (
  mode: NumberFilterState['mode'],
  minimum: string,
  maximum: string,
): NumberFilterState => ({ maximum, minimum, mode });

const ACCOUNT_COLUMNS = { balance: 'balance', opening: 'opening', text: ['Main'] as const };
const ASSET_COLUMNS = { text: ['EURUSD'] as const, tickSize: 'tickSize', tickValue: 'tickValue' };

describe('entity table filters', () => {
  it('keeps the active-status default invisible and reports any other state', () => {
    expect(isEntityFilterDefault(createEntityTableFilterState(['active']))).toBe(true);
    expect(
      isEntityFilterDefault({ ...createEntityTableFilterState(['active']), textQuery: 'main' }),
    ).toBe(false);
    expect(isEntityFilterDefault(createEntityTableFilterState(['active', 'archived']))).toBe(false);
    expect(
      isEntityFilterDefault({
        ...createEntityTableFilterState(['active']),
        statuses: ['archived'],
      }),
    ).toBe(false);
  });

  it('filters accounts by name, status and numeric bounds', () => {
    const state = createEntityTableFilterState(['active']);
    const archived = account({ archivedAt: '2026-01-01T00:00:00.000Z' });

    expect(matchesEntityFilters(account(), state, ACCOUNT_COLUMNS)).toBe(true);
    expect(matchesEntityFilters(account(), { ...state, textQuery: 'MAI' }, ACCOUNT_COLUMNS)).toBe(
      true,
    );
    expect(matchesEntityFilters(account(), { ...state, textQuery: 'Other' }, ACCOUNT_COLUMNS)).toBe(
      false,
    );
    expect(matchesEntityFilters(archived, state, ACCOUNT_COLUMNS)).toBe(false);
    expect(
      matchesEntityFilters(archived, { ...state, statuses: ['archived'] }, ACCOUNT_COLUMNS),
    ).toBe(true);
    expect(
      matchesEntityFilters(
        account({ openingBalanceUsd: '500.01' }),
        {
          ...state,
          numberBounds: { opening: bounds(NUMBER_FILTER_MODES.lessThan, '', '500') },
        },
        ACCOUNT_COLUMNS,
      ),
    ).toBe(false);
    expect(
      matchesEntityFilters(
        account({ openingBalanceUsd: '499.99' }),
        {
          ...state,
          numberBounds: { opening: bounds(NUMBER_FILTER_MODES.lessThan, '', '500') },
        },
        ACCOUNT_COLUMNS,
      ),
    ).toBe(true);
  });

  it('filters assets by category', () => {
    const state = createEntityTableFilterState(['active']);

    expect(matchesEntityFilters(asset(), { ...state, categories: ['forex'] }, ASSET_COLUMNS)).toBe(
      true,
    );
    expect(matchesEntityFilters(asset(), { ...state, categories: ['crypto'] }, ASSET_COLUMNS)).toBe(
      false,
    );
  });

  it('drops rows without a value once a numeric filter is active', () => {
    const state = createEntityTableFilterState(['active']);
    const withProfileBounds = {
      ...state,
      numberBounds: { tickSize: bounds(NUMBER_FILTER_MODES.lessThan, '', '0.001') },
    };

    expect(matchesEntityFilters(asset(), withProfileBounds, ASSET_COLUMNS)).toBe(false);
    expect(
      matchesEntityFilters(asset({ tickSize: '0.0001' }), withProfileBounds, ASSET_COLUMNS),
    ).toBe(true);
    expect(matchesEntityFilters(asset(), state, ASSET_COLUMNS)).toBe(true);
  });

  it('keeps archived assets reachable when both statuses are selected', () => {
    const state = createEntityTableFilterState(['active', 'archived']);

    expect(matchesEntityFilters(asset(), state, ASSET_COLUMNS)).toBe(true);
    expect(
      matchesEntityFilters(asset({ archivedAt: '2026-01-01T00:00:00.000Z' }), state, ASSET_COLUMNS),
    ).toBe(true);
  });

  it('hydrates missing bounds lazily for a column without a stored filter', () => {
    expect(getEntityNumberBounds(createEntityTableFilterState(['active']), 'tickSize')).toEqual({
      maximum: '',
      minimum: '',
      mode: NUMBER_FILTER_MODES.greaterThan,
    });
  });

  it('highlights only the column whose filter changed', () => {
    const state = createEntityTableFilterState(['active']);

    expect(isEntityColumnFilterActive(state, 'name', 'text', 'status')).toBe(false);
    expect(isEntityColumnFilterActive(state, 'status', 'multi-select', 'status')).toBe(false);
    expect(isEntityColumnFilterActive(state, 'tickSize', 'number', 'status')).toBe(false);

    expect(
      isEntityColumnFilterActive({ ...state, textQuery: 'mai' }, 'name', 'text', 'status'),
    ).toBe(true);
    expect(
      isEntityColumnFilterActive(
        { ...state, statuses: ['archived'] },
        'status',
        'multi-select',
        'status',
      ),
    ).toBe(true);
    expect(
      isEntityColumnFilterActive(
        { ...state, categories: ['crypto'] },
        'category',
        'multi-select',
        'status',
      ),
    ).toBe(true);
    expect(
      isEntityColumnFilterActive(
        { ...state, numberBounds: { tickSize: bounds(NUMBER_FILTER_MODES.lessThan, '', '1') } },
        'tickSize',
        'number',
        'status',
      ),
    ).toBe(true);
    expect(
      isEntityColumnFilterActive({ ...state, textQuery: 'mai' }, 'name', 'text', 'status'),
    ).toBe(true);
    expect(
      isEntityColumnFilterActive(
        { ...state, textQuery: 'mai' },
        'status',
        'multi-select',
        'status',
      ),
    ).toBe(false);
  });
});
