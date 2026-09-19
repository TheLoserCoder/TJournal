import type { ColumnOrderState } from '@tanstack/react-table';

import type { TableColumnLayoutDto, TableDisplayMode } from '../../../shared/desktop-api';

export const TRADE_TABLE_COLUMN_IDS = {
  account: 'account',
  asset: 'asset',
  closedAt: 'closedAt',
  closedAtTime: 'closedAtTime',
  direction: 'direction',
  id: 'id',
  result: 'result',
  resultKind: 'resultKind',
  selection: 'selection',
} as const;

export const TRADE_RESULT_FILTERS = {
  all: 'all',
  cash: 'cash',
  percent: 'percent',
  r: 'r',
} as const;

const DATA_COLUMN_IDS = [
  TRADE_TABLE_COLUMN_IDS.account,
  TRADE_TABLE_COLUMN_IDS.result,
  TRADE_TABLE_COLUMN_IDS.asset,
  TRADE_TABLE_COLUMN_IDS.closedAt,
  TRADE_TABLE_COLUMN_IDS.direction,
  TRADE_TABLE_COLUMN_IDS.closedAtTime,
  TRADE_TABLE_COLUMN_IDS.resultKind,
  TRADE_TABLE_COLUMN_IDS.id,
] as const;

const DEFAULT_COLUMN_WIDTH = 160;
const NARROW_COLUMN_WIDTH = 88;
const WIDE_COLUMN_WIDTH = 280;

export const TRADE_TABLE_COLUMN_SIZE_LIMITS = {
  maximum: 480,
  minimum: 72,
} as const;

export const DEFAULT_TRADE_TABLE_COLUMNS: readonly TableColumnLayoutDto[] = [
  { id: TRADE_TABLE_COLUMN_IDS.result, visible: true, width: DEFAULT_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.asset, visible: true, width: DEFAULT_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.closedAt, visible: true, width: DEFAULT_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.direction, visible: true, width: NARROW_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.account, visible: false, width: DEFAULT_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.closedAtTime, visible: false, width: DEFAULT_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.resultKind, visible: false, width: NARROW_COLUMN_WIDTH },
  { id: TRADE_TABLE_COLUMN_IDS.id, visible: false, width: WIDE_COLUMN_WIDTH },
];

export const DEFAULT_TRADE_TABLE_COLUMN_ORDER: ColumnOrderState = [
  TRADE_TABLE_COLUMN_IDS.selection,
  ...DEFAULT_TRADE_TABLE_COLUMNS.map((column) => column.id),
];

export const normalizeTradeTableColumnOrder = (
  order: readonly string[] | undefined,
): ColumnOrderState => {
  if (!order?.includes(TRADE_TABLE_COLUMN_IDS.selection)) {
    return [...DEFAULT_TRADE_TABLE_COLUMN_ORDER];
  }
  const knownIds = new Set(DEFAULT_TRADE_TABLE_COLUMN_ORDER);
  const preservedIds = (order ?? []).filter((id) => knownIds.has(id));
  return [
    ...preservedIds,
    ...DEFAULT_TRADE_TABLE_COLUMN_ORDER.filter((id) => !preservedIds.includes(id)),
  ];
};

export const DEFAULT_TRADE_TABLE_MODE: TableDisplayMode = 'compact';

const COMPACT_VISIBILITY: Readonly<Record<(typeof DATA_COLUMN_IDS)[number], boolean>> = {
  [TRADE_TABLE_COLUMN_IDS.account]: false,
  [TRADE_TABLE_COLUMN_IDS.asset]: true,
  [TRADE_TABLE_COLUMN_IDS.closedAt]: true,
  [TRADE_TABLE_COLUMN_IDS.closedAtTime]: false,
  [TRADE_TABLE_COLUMN_IDS.direction]: true,
  [TRADE_TABLE_COLUMN_IDS.id]: false,
  [TRADE_TABLE_COLUMN_IDS.result]: true,
  [TRADE_TABLE_COLUMN_IDS.resultKind]: false,
};

const ADVANCED_VISIBILITY: Readonly<Record<(typeof DATA_COLUMN_IDS)[number], boolean>> = {
  [TRADE_TABLE_COLUMN_IDS.account]: true,
  [TRADE_TABLE_COLUMN_IDS.asset]: true,
  [TRADE_TABLE_COLUMN_IDS.closedAt]: false,
  [TRADE_TABLE_COLUMN_IDS.closedAtTime]: true,
  [TRADE_TABLE_COLUMN_IDS.direction]: true,
  [TRADE_TABLE_COLUMN_IDS.id]: true,
  [TRADE_TABLE_COLUMN_IDS.result]: true,
  [TRADE_TABLE_COLUMN_IDS.resultKind]: true,
};

export const getTradeTableVisibility = (
  mode: TableDisplayMode,
): Readonly<Record<(typeof DATA_COLUMN_IDS)[number], boolean>> =>
  mode === 'advanced' ? ADVANCED_VISIBILITY : COMPACT_VISIBILITY;

export const isTradeTableDataColumn = (columnId: string): boolean =>
  DATA_COLUMN_IDS.some((id) => id === columnId);
