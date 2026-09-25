import { describe, expect, it } from 'vitest';

import { TABLE_DISPLAY_MODES } from '../../../shared/desktop-api';
import {
  DEFAULT_TRADE_TABLE_COLUMNS,
  DEFAULT_TRADE_TABLE_COLUMN_ORDER,
  getTradeTableVisibility,
  normalizeTradeTableColumnOrder,
  TRADE_TABLE_COLUMN_IDS,
  TRADE_TABLE_FILTER_SCHEMAS,
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

  it('uses result, asset, tags, type, account and date as the canonical visible order', () => {
    const visibleColumns = DEFAULT_TRADE_TABLE_COLUMNS.filter((column) => column.visible).map(
      (column) => column.id,
    );

    expect(visibleColumns).toEqual([
      TRADE_TABLE_COLUMN_IDS.result,
      TRADE_TABLE_COLUMN_IDS.asset,
      TRADE_TABLE_COLUMN_IDS.tags,
      TRADE_TABLE_COLUMN_IDS.direction,
      TRADE_TABLE_COLUMN_IDS.account,
      TRADE_TABLE_COLUMN_IDS.closedAt,
    ]);
    expect(
      getTradeTableVisibility(TABLE_DISPLAY_MODES.compact)[TRADE_TABLE_COLUMN_IDS.account],
    ).toBe(true);
  });

  it('keeps the asset type column configurable through the table settings', () => {
    expect(DEFAULT_TRADE_TABLE_COLUMN_ORDER.includes(TRADE_TABLE_COLUMN_IDS.assetCategory)).toBe(
      true,
    );
    expect(
      getTradeTableVisibility(TABLE_DISPLAY_MODES.compact)[TRADE_TABLE_COLUMN_IDS.assetCategory],
    ).toBe(false);
    expect(
      getTradeTableVisibility(TABLE_DISPLAY_MODES.advanced)[TRADE_TABLE_COLUMN_IDS.assetCategory],
    ).toBe(true);
  });

  it('migrates a legacy layout order to the canonical order', () => {
    const legacyOrder = [
      TRADE_TABLE_COLUMN_IDS.closedAt,
      TRADE_TABLE_COLUMN_IDS.asset,
      TRADE_TABLE_COLUMN_IDS.result,
    ];

    expect(normalizeTradeTableColumnOrder(legacyOrder)).toEqual(DEFAULT_TRADE_TABLE_COLUMN_ORDER);
    expect(normalizeTradeTableColumnOrder(DEFAULT_TRADE_TABLE_COLUMN_ORDER)).toEqual(
      DEFAULT_TRADE_TABLE_COLUMN_ORDER,
    );
  });

  it('declares a filter for every data column and none for row selection', () => {
    const dataColumnIds = Object.values(TRADE_TABLE_COLUMN_IDS).filter(
      (id) => id !== TRADE_TABLE_COLUMN_IDS.selection,
    );

    expect(Object.keys(TRADE_TABLE_FILTER_SCHEMAS).sort()).toEqual(dataColumnIds.sort());
    expect(
      Object.values(TRADE_TABLE_FILTER_SCHEMAS).every((schema) => schema.kind !== 'none'),
    ).toBe(true);
  });

  it('keeps every data column present in the layout defaults and compact mode', () => {
    for (const columnId of Object.values(TRADE_TABLE_COLUMN_IDS)) {
      if (columnId === TRADE_TABLE_COLUMN_IDS.selection) continue;
      expect(DEFAULT_TRADE_TABLE_COLUMNS.some((column) => column.id === columnId)).toBe(true);
      expect(getTradeTableVisibility('compact')).toHaveProperty(columnId);
      expect(getTradeTableVisibility('advanced')).toHaveProperty(columnId);
    }
  });
});
