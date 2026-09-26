import type { ColumnOrderState } from '@tanstack/react-table';

import type {
  InstrumentCategory,
  TableColumnLayoutDto,
  TableDisplayMode,
} from '../../../shared/desktop-api';
import type { DataTableColumnFilterSchema } from '../../components/data-table-filter';
import { TRANSLATION_KEYS } from '../../i18n-keys';

export const ACCOUNT_COLUMN_IDS = {
  balance: 'balance',
  name: 'name',
  opening: 'opening',
  selection: 'selection',
  status: 'status',
} as const;
export type AccountColumnId = (typeof ACCOUNT_COLUMN_IDS)[keyof typeof ACCOUNT_COLUMN_IDS];

export const ASSET_COLUMN_IDS = {
  category: 'category',
  selection: 'selection',
  status: 'status',
  symbol: 'symbol',
} as const;
export type AssetColumnId = (typeof ASSET_COLUMN_IDS)[keyof typeof ASSET_COLUMN_IDS];

export const TAG_COLUMN_IDS = {
  description: 'description',
  name: 'name',
  selection: 'selection',
  tradeCount: 'tradeCount',
} as const;
export type TagColumnId = (typeof TAG_COLUMN_IDS)[keyof typeof TAG_COLUMN_IDS];

export const ENTITY_TABLE_MODE: TableDisplayMode = 'compact';
export const ENTITY_TABLE_SIZE_LIMITS = { maximum: 420, minimum: 56 } as const;
export const ENTITY_STATUS_ACTIVE = 'active';
export const ENTITY_STATUS_ARCHIVED = 'archived';

export const INSTRUMENT_CATEGORIES = [
  'forex',
  'crypto',
  'metal',
  'energy',
  'index',
  'equity',
  'etf',
] as const;

/** Fallback type for a new asset when the user has not chosen one yet. */
export const DEFAULT_INSTRUMENT_CATEGORY: InstrumentCategory = 'forex';

/** Localized labels of the instrument types; shared by the statistics and trade tables. */
export const INSTRUMENT_CATEGORY_LABEL_KEYS: Readonly<Record<InstrumentCategory, string>> = {
  crypto: TRANSLATION_KEYS.statisticsCategoryCrypto,
  energy: TRANSLATION_KEYS.statisticsCategoryEnergy,
  equity: TRANSLATION_KEYS.statisticsCategoryEquity,
  etf: TRANSLATION_KEYS.statisticsCategoryEtf,
  forex: TRANSLATION_KEYS.statisticsCategoryForex,
  index: TRANSLATION_KEYS.statisticsCategoryIndex,
  metal: TRANSLATION_KEYS.statisticsCategoryMetal,
};

export type EntityColumnSchema = DataTableColumnFilterSchema & {
  /** Translation key of the column header, used for labels and aria names. */
  readonly labelKey: string;
  /** Unit label for numeric bounds, for example the currency of a stored value. */
  readonly unit?: string;
};

export const ACCOUNT_COLUMN_SCHEMAS: Readonly<
  Record<Exclude<AccountColumnId, 'selection'>, EntityColumnSchema>
> = {
  [ACCOUNT_COLUMN_IDS.balance]: {
    kind: 'number',
    labelKey: TRANSLATION_KEYS.fieldAccountBalance,
    unit: TRANSLATION_KEYS.tradeUnitCash,
  },
  [ACCOUNT_COLUMN_IDS.name]: { kind: 'text', labelKey: TRANSLATION_KEYS.fieldAccount },
  [ACCOUNT_COLUMN_IDS.opening]: {
    kind: 'number',
    labelKey: TRANSLATION_KEYS.fieldAccountOpening,
    unit: TRANSLATION_KEYS.tradeUnitCash,
  },
  [ACCOUNT_COLUMN_IDS.status]: { kind: 'multi-select', labelKey: TRANSLATION_KEYS.fieldStatus },
};

export const ASSET_COLUMN_SCHEMAS: Readonly<
  Record<Exclude<AssetColumnId, 'selection'>, EntityColumnSchema>
> = {
  [ASSET_COLUMN_IDS.category]: {
    kind: 'multi-select',
    labelKey: TRANSLATION_KEYS.fieldCategory,
  },
  [ASSET_COLUMN_IDS.status]: { kind: 'multi-select', labelKey: TRANSLATION_KEYS.fieldStatus },
  [ASSET_COLUMN_IDS.symbol]: { kind: 'text', labelKey: TRANSLATION_KEYS.fieldAsset },
};

export const TAG_COLUMN_SCHEMAS: Readonly<
  Record<Exclude<TagColumnId, 'selection'>, EntityColumnSchema>
> = {
  [TAG_COLUMN_IDS.name]: { kind: 'text', labelKey: TRANSLATION_KEYS.fieldTag },
  [TAG_COLUMN_IDS.description]: {
    kind: 'text',
    labelKey: TRANSLATION_KEYS.fieldTagDescription,
  },
  [TAG_COLUMN_IDS.tradeCount]: { kind: 'number', labelKey: TRANSLATION_KEYS.fieldTagTradeCount },
};

export interface EntityFilterSchemaEntry {
  readonly columnId: string;
  readonly schema: EntityColumnSchema;
}

export const toEntityFilterEntries = (
  schemas: Readonly<Record<string, EntityColumnSchema>>,
): readonly EntityFilterSchemaEntry[] =>
  Object.entries(schemas).map(([columnId, schema]) => ({ columnId, schema }));

const ENTITY_TABLE_COLUMNS = {
  accounts: [
    { id: ACCOUNT_COLUMN_IDS.selection, visible: true, width: 48 },
    { id: ACCOUNT_COLUMN_IDS.name, visible: true, width: 220 },
    { id: ACCOUNT_COLUMN_IDS.opening, visible: true, width: 150 },
    { id: ACCOUNT_COLUMN_IDS.balance, visible: true, width: 180 },
    { id: ACCOUNT_COLUMN_IDS.status, visible: true, width: 130 },
  ],
  assets: [
    { id: ASSET_COLUMN_IDS.selection, visible: true, width: 48 },
    { id: ASSET_COLUMN_IDS.symbol, visible: true, width: 160 },
    { id: ASSET_COLUMN_IDS.category, visible: true, width: 140 },
    { id: ASSET_COLUMN_IDS.status, visible: true, width: 130 },
  ],
  tags: [
    { id: TAG_COLUMN_IDS.selection, visible: true, width: 48 },
    { id: TAG_COLUMN_IDS.name, visible: true, width: 220 },
    { id: TAG_COLUMN_IDS.description, visible: true, width: 320 },
    { id: TAG_COLUMN_IDS.tradeCount, visible: true, width: 120 },
  ],
} as const satisfies Readonly<
  Record<'accounts' | 'assets' | 'tags', readonly TableColumnLayoutDto[]>
>;

export type EntityTableId = keyof typeof ENTITY_TABLE_COLUMNS;

export const getEntityTableColumns = (table: EntityTableId): readonly TableColumnLayoutDto[] =>
  ENTITY_TABLE_COLUMNS[table];

export const normalizeEntityOrder =
  (allowed: readonly string[]) =>
  (order: readonly string[] | undefined): ColumnOrderState => [
    ...allowed.filter((id) => order?.includes(id)),
    ...allowed.filter((id) => !order?.includes(id)),
  ];

export const entityVisibility =
  (columns: readonly { readonly id: string; readonly visible: boolean }[]) => () =>
    Object.fromEntries(columns.map((column) => [column.id, column.visible]));

export const ENTITY_STATUS_OPTION_KEYS = {
  [ENTITY_STATUS_ACTIVE]: TRANSLATION_KEYS.statusActive,
  [ENTITY_STATUS_ARCHIVED]: TRANSLATION_KEYS.statusArchived,
} as const;
