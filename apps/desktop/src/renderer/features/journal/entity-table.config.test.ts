import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_COLUMN_IDS,
  ACCOUNT_COLUMN_SCHEMAS,
  ASSET_COLUMN_IDS,
  ASSET_COLUMN_SCHEMAS,
  getEntityTableColumns,
  TAG_COLUMN_IDS,
  TAG_COLUMN_SCHEMAS,
  toEntityFilterEntries,
} from './entity-table.config';

describe('entity table configuration', () => {
  it('declares a filter for every accounts data column', () => {
    const dataColumnIds = Object.values(ACCOUNT_COLUMN_IDS).filter(
      (id) => id !== ACCOUNT_COLUMN_IDS.selection,
    );

    expect(Object.keys(ACCOUNT_COLUMN_SCHEMAS).sort()).toEqual([...dataColumnIds].sort());
  });

  it('declares a filter for every assets data column', () => {
    const dataColumnIds = Object.values(ASSET_COLUMN_IDS).filter(
      (id) => id !== ASSET_COLUMN_IDS.selection,
    );

    expect(Object.keys(ASSET_COLUMN_SCHEMAS).sort()).toEqual([...dataColumnIds].sort());
  });

  it('declares a filter for every tags data column', () => {
    const dataColumnIds = Object.values(TAG_COLUMN_IDS).filter(
      (id) => id !== TAG_COLUMN_IDS.selection,
    );

    expect(Object.keys(TAG_COLUMN_SCHEMAS).sort()).toEqual([...dataColumnIds].sort());
  });

  it('keeps every layout column addressable by the schema-driven table', () => {
    for (const table of ['accounts', 'assets', 'tags'] as const) {
      for (const column of getEntityTableColumns(table)) {
        expect(column.id.length).toBeGreaterThan(0);
        expect(column.width).toBeGreaterThan(0);
      }
    }
  });

  it('exports filter entries with resolvable column labels', () => {
    for (const entry of [
      ...toEntityFilterEntries(ACCOUNT_COLUMN_SCHEMAS),
      ...toEntityFilterEntries(ASSET_COLUMN_SCHEMAS),
      ...toEntityFilterEntries(TAG_COLUMN_SCHEMAS),
    ]) {
      expect(entry.schema.kind).not.toBe('none');
      expect(entry.schema.labelKey.length).toBeGreaterThan(0);
    }
  });
});
