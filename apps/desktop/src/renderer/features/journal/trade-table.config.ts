import type { ColumnOrderState } from '@tanstack/react-table';

import type {
  JournalPageSortField,
  TableColumnLayoutDto,
  TableDisplayMode,
} from '../../../shared/desktop-api';
import type { DataTableColumnFilterSchema } from '../../components/data-table-filter';

export const TRADE_TABLE_COLUMN_IDS = {
  account: 'account',
  asset: 'asset',
  assetCategory: 'assetCategory',
  closedAt: 'closedAt',
  closedAtTime: 'closedAtTime',
  direction: 'direction',
  id: 'id',
  result: 'result',
  resultKind: 'resultKind',
  selection: 'selection',
  tags: 'tags',
} as const;
export type TradeTableColumnId =
  (typeof TRADE_TABLE_COLUMN_IDS)[keyof typeof TRADE_TABLE_COLUMN_IDS];

export const TRADE_RESULT_FILTERS = {
  all: 'all',
  cash: 'cash',
  percent: 'percent',
  r: 'r',
} as const;

/**
 * Every data column declares the filter surface it offers. The explicit Record
 * annotation over the column id union turns a forgotten entry into a
 * type-check error, so a new column cannot silently ship without a filter.
 */
export const TRADE_TABLE_FILTER_SCHEMAS: Readonly<
  Record<Exclude<TradeTableColumnId, 'selection'>, DataTableColumnFilterSchema>
> = {
  [TRADE_TABLE_COLUMN_IDS.account]: { kind: 'multi-select' },
  [TRADE_TABLE_COLUMN_IDS.asset]: { kind: 'multi-select' },
  [TRADE_TABLE_COLUMN_IDS.assetCategory]: { kind: 'multi-select' },
  [TRADE_TABLE_COLUMN_IDS.closedAt]: { kind: 'date-range' },
  [TRADE_TABLE_COLUMN_IDS.closedAtTime]: { kind: 'datetime-range' },
  [TRADE_TABLE_COLUMN_IDS.direction]: { kind: 'multi-select' },
  [TRADE_TABLE_COLUMN_IDS.id]: { kind: 'text' },
  [TRADE_TABLE_COLUMN_IDS.result]: { kind: 'number', unitLabel: 'USD' },
  [TRADE_TABLE_COLUMN_IDS.resultKind]: { kind: 'multi-select' },
  [TRADE_TABLE_COLUMN_IDS.tags]: { kind: 'multi-select' },
};

const DATA_COLUMN_IDS = [
  TRADE_TABLE_COLUMN_IDS.account,
  TRADE_TABLE_COLUMN_IDS.asset,
  TRADE_TABLE_COLUMN_IDS.assetCategory,
  TRADE_TABLE_COLUMN_IDS.closedAt,
  TRADE_TABLE_COLUMN_IDS.closedAtTime,
  TRADE_TABLE_COLUMN_IDS.direction,
  TRADE_TABLE_COLUMN_IDS.id,
  TRADE_TABLE_COLUMN_IDS.result,
  TRADE_TABLE_COLUMN_IDS.resultKind,
  TRADE_TABLE_COLUMN_IDS.tags,
] as const;

const DEFAULT_COLUMN_WIDTH = 160;
const NARROW_COLUMN_WIDTH = 88;
const WIDE_COLUMN_WIDTH = 280;
const TAGS_COLUMN_WIDTH = 220;

export const TRADE_TABLE_COLUMN_SIZE_LIMITS = {
  maximum: 480,
  minimum: 48,
} as const;

/** Fixed row height for windowed rendering; must match the `--table-row-height` token. */
export const TRADE_TABLE_ROW_HEIGHT = 48;

export const DEFAULT_TRADE_TABLE_COLUMNS: readonly TableColumnLayoutDto[] = [
  { id: TRADE_TABLE_COLUMN_IDS.result, visible: true, width: DEFAULT_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.asset, visible: true, width: DEFAULT_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.tags, visible: true, width: TAGS_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.assetCategory, visible: false, width: NARROW_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.direction, visible: true, width: NARROW_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.account, visible: true, width: DEFAULT_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.closedAt, visible: true, width: DEFAULT_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.closedAtTime, visible: false, width: DEFAULT_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.resultKind, visible: false, width: NARROW_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.id, visible: false, width: WIDE_COLUMN_WIDTH },
];

export const DEFAULT_TRADE_TABLE_COLUMN_ORDER: ColumnOrderState = [
  TRADE_TABLE_COLUMN_IDS.selection,
  ...DEFAULT_TRADE_TABLE_COLUMNS.map((column) => column.id),
];

/**
 * Column order is owned by the configuration: the table has no column-drag
 * surface, so a previously persisted order would only freeze an older layout.
 * Visibility and widths still come from the saved layout.
 */
export const normalizeTradeTableColumnOrder = (
  _order: readonly string[] | undefined,
): ColumnOrderState => [...DEFAULT_TRADE_TABLE_COLUMN_ORDER];

export const DEFAULT_TRADE_TABLE_MODE: TableDisplayMode = 'compact';

const COMPACT_VISIBILITY: Readonly<Record<string, boolean>> = {
  [TRADE_TABLE_COLUMN_IDS.account]: true,
  [TRADE_TABLE_COLUMN_IDS.asset]: true,
  [TRADE_TABLE_COLUMN_IDS.assetCategory]: false,
  [TRADE_TABLE_COLUMN_IDS.closedAt]: true,
  [TRADE_TABLE_COLUMN_IDS.closedAtTime]: false,
  [TRADE_TABLE_COLUMN_IDS.direction]: true,
  [TRADE_TABLE_COLUMN_IDS.id]: false,
  [TRADE_TABLE_COLUMN_IDS.result]: true,
  [TRADE_TABLE_COLUMN_IDS.resultKind]: false,
  [TRADE_TABLE_COLUMN_IDS.tags]: true,
};

const ADVANCED_VISIBILITY: Readonly<Record<string, boolean>> = {
  [TRADE_TABLE_COLUMN_IDS.account]: true,
  [TRADE_TABLE_COLUMN_IDS.asset]: true,
  [TRADE_TABLE_COLUMN_IDS.assetCategory]: true,
  [TRADE_TABLE_COLUMN_IDS.closedAt]: false,
  [TRADE_TABLE_COLUMN_IDS.closedAtTime]: true,
  [TRADE_TABLE_COLUMN_IDS.direction]: true,
  [TRADE_TABLE_COLUMN_IDS.id]: true,
  [TRADE_TABLE_COLUMN_IDS.result]: true,
  [TRADE_TABLE_COLUMN_IDS.resultKind]: true,
  [TRADE_TABLE_COLUMN_IDS.tags]: true,
};

export const getTradeTableVisibility = (
  mode: TableDisplayMode,
): Readonly<Record<string, boolean>> =>
  mode === 'advanced' ? ADVANCED_VISIBILITY : COMPACT_VISIBILITY;

export const isTradeTableDataColumn = (columnId: string): boolean =>
  DATA_COLUMN_IDS.some((id) => id === columnId);

/**
 * Server sort allowlist: only these columns can be sorted, and each maps to
 * the bounded read model's sort field. Other columns must not display a sort
 * affordance because their order cannot be produced by SQLite.
 */
export const TRADE_TABLE_SORT_FIELDS: Readonly<Record<string, JournalPageSortField | undefined>> = {
  [TRADE_TABLE_COLUMN_IDS.account]: 'account',
  [TRADE_TABLE_COLUMN_IDS.asset]: 'asset',
  [TRADE_TABLE_COLUMN_IDS.closedAt]: 'date',
  [TRADE_TABLE_COLUMN_IDS.direction]: 'type',
  [TRADE_TABLE_COLUMN_IDS.result]: 'result',
};

export const isTradeTableSortableColumn = (columnId: string): boolean =>
  Object.hasOwn(TRADE_TABLE_SORT_FIELDS, columnId);
