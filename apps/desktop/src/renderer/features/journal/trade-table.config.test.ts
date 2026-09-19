import { describe, expect, it } from 'vitest';

import { TABLE_DISPLAY_MODES } from '../../../shared/desktop-api';
import {
  DEFAULT_TRADE_TABLE_COLUMN_ORDER,
  getTradeTableVisibility,
  normalizeTradeTableColumnOrder,
  TRADE_TABLE_COLUMN_IDS,
} from './trade-table.config';

describe('trade table configuration', () => {
  it('uses only the essential columns in compact mode', () => {
    const visibility = getTradeTableVisibility(TABLE_DISPLAY_MODES.compact);

    expect(visibility[TRADE_TABLE_COLUMN_IDS.closedAt]).toBe(true);
    expect(visibility[TRADE_TABLE_COLUMN_IDS.closedAtTime]).toBe(false);
    expect(visibility[TRADE_TABLE_COLUMN_IDS.id]).toBe(false);
  });

  it('shows technical fields in advanced mode', () => {
    const visibility = getTradeTableVisibility(TABLE_DISPLAY_MODES.advanced);

    expect(visibility[TRADE_TABLE_COLUMN_IDS.closedAt]).toBe(false);
    expect(visibility[TRADE_TABLE_COLUMN_IDS.closedAtTime]).toBe(true);
    expect(visibility[TRADE_TABLE_COLUMN_IDS.id]).toBe(true);
  });

  it('uses result, asset and date as the canonical visible order', () => {
    expect(DEFAULT_TRADE_TABLE_COLUMN_ORDER.slice(0, 4)).toEqual([
      TRADE_TABLE_COLUMN_IDS.selection,
      TRADE_TABLE_COLUMN_IDS.result,
      TRADE_TABLE_COLUMN_IDS.asset,
      TRADE_TABLE_COLUMN_IDS.closedAt,
    ]);
  });

  it('migrates a legacy layout order to the canonical order', () => {
    const legacyOrder = [
      TRADE_TABLE_COLUMN_IDS.closedAt,
      TRADE_TABLE_COLUMN_IDS.asset,
      TRADE_TABLE_COLUMN_IDS.result,
    ];

    expect(normalizeTradeTableColumnOrder(legacyOrder)).toEqual(DEFAULT_TRADE_TABLE_COLUMN_ORDER);
  });
});
