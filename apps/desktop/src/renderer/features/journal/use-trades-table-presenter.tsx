import type { LegacyReactTable } from '@tanstack/react-table/legacy';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  TABLE_IDENTIFIERS,
  type AccountDto,
  type CashMovementDto,
  type InstrumentDto,
  type TableDisplayMode,
  type TableLayoutDto,
  type TradeDto,
  type TradePreferencesDto,
} from '../../../shared/desktop-api';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { useDataTableController } from '../../components/use-data-table-controller';
import { createTradeTableColumns } from './trade-table-columns';
import { toJournalEntryRows, type JournalEntryRow } from './journal-entry-row';
import {
  DEFAULT_TRADE_TABLE_COLUMNS,
  normalizeTradeTableColumnOrder,
  DEFAULT_TRADE_TABLE_MODE,
  getTradeTableVisibility,
  isTradeTableDataColumn,
  TRADE_TABLE_COLUMN_SIZE_LIMITS,
  TRADE_RESULT_FILTERS,
} from './trade-table.config';

type TradeResultFilter = 'all' | TradeDto['resultKind'];
interface TradeTableColumnControl {
  readonly id: string;
  readonly label: string;
  readonly visible: boolean;
}

export interface TradesTablePresenter {
  readonly accountFilterIds: readonly string[];
  readonly accountOptions: readonly { readonly id: string; readonly label: string }[];
  readonly includeUnassigned: boolean;
  readonly activeFilterColumnId: string | null;
  readonly assetFilterIds: readonly string[];
  readonly assetOptions: readonly { readonly id: string; readonly label: string }[];
  readonly columns: readonly TradeTableColumnControl[];
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly mode: TableDisplayMode;
  readonly resultFilter: TradeResultFilter;
  readonly showCashMovements: boolean;
  readonly selectedCount: number;
  readonly selectedCashMovement: CashMovementDto | null;
  readonly selectedCashMovementIds: readonly string[];
  readonly selectedTrade: TradeDto | null;
  readonly selectedTradeIds: readonly string[];
  readonly table: LegacyReactTable<JournalEntryRow>;
  readonly filteredTradeIds: readonly string[];
  clearSelection(): void;
  applyLayout(
    mode: TableDisplayMode,
    columns: readonly { readonly id: string; readonly visible: boolean }[],
  ): void;
  setDateFrom(value: string): void;
  setDateTo(value: string): void;
  setAssetFilterIds(ids: readonly string[]): void;
  setAccountFilterIds(ids: readonly string[]): void;
  setIncludeUnassigned(value: boolean): void;
  setMode(value: TableDisplayMode): void;
  setResultFilter(value: TradeResultFilter): void;
  setShowCashMovements(value: boolean): void;
  toggleColumn(id: string): void;
  setActiveFilter(columnId: string | null): void;
}

interface UseTradesTablePresenterOptions {
  readonly accounts: readonly AccountDto[];
  readonly cashMovements: readonly CashMovementDto[];
  readonly instruments: readonly InstrumentDto[];
  readonly layout: TableLayoutDto | undefined;
  readonly onLayoutChange: (layout: TableLayoutDto) => void;
  readonly trades: readonly TradeDto[];
  readonly tradePreferences: TradePreferencesDto;
}

const getDatePart = (dateTime: string): string => dateTime.slice(0, 10);

export const orderInstrumentSelection = (
  instruments: readonly InstrumentDto[],
  trades: readonly TradeDto[],
): readonly InstrumentDto[] => {
  const latestUse = new Map<string, string>();
  trades.forEach((trade) => {
    const previous = latestUse.get(trade.instrumentId);
    if (previous === undefined || trade.closedAt > previous)
      latestUse.set(trade.instrumentId, trade.closedAt);
  });
  return [...instruments].sort((left, right) => {
    const leftUsedAt = latestUse.get(left.id);
    const rightUsedAt = latestUse.get(right.id);
    if (leftUsedAt !== undefined || rightUsedAt !== undefined) {
      if (leftUsedAt === undefined) return 1;
      if (rightUsedAt === undefined) return -1;
      return (
        rightUsedAt.localeCompare(leftUsedAt) ||
        left.symbol.localeCompare(right.symbol) ||
        left.id.localeCompare(right.id)
      );
    }
    const sourceOrder = (source: InstrumentDto['source']): number => (source === 'seed' ? 0 : 1);
    return (
      sourceOrder(left.source) - sourceOrder(right.source) ||
      left.symbol.localeCompare(right.symbol) ||
      left.id.localeCompare(right.id)
    );
  });
};

export const useTradesTablePresenter = ({
  accounts,
  cashMovements,
  layout,
  instruments,
  onLayoutChange,
  tradePreferences,
  trades,
}: UseTradesTablePresenterOptions): TradesTablePresenter => {
  const { t } = useTranslation();
  const [assetFilterIds, setAssetFilterIds] = useState<readonly string[]>([]);
  const [accountFilterIds, setAccountFilterIds] = useState<readonly string[]>([]);
  const [includeUnassigned, setIncludeUnassigned] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [resultFilter, setResultFilter] = useState<TradeResultFilter>(TRADE_RESULT_FILTERS.all);
  const [showCashMovements, setShowCashMovements] = useState(true);

  const accountOptions = useMemo(
    () => accounts.map((account) => ({ id: account.id, label: account.name })),
    [accounts],
  );

  const assetOptions = useMemo(() => {
    return orderInstrumentSelection(instruments, trades).map((instrument) => ({
      id: instrument.id,
      label: instrument.symbol,
    }));
  }, [instruments, trades]);

  const filteredTrades = useMemo(
    () =>
      trades.filter((trade) => {
        const date = getDatePart(trade.closedAt);
        return (
          (assetFilterIds.length === 0 || assetFilterIds.includes(trade.instrumentId)) &&
          ((accountFilterIds.length === 0 && !includeUnassigned) ||
            accountFilterIds.includes(trade.account?.accountId ?? '') ||
            (includeUnassigned &&
              (trade.account?.accountId === undefined || trade.account?.accountId === null))) &&
          (resultFilter === TRADE_RESULT_FILTERS.all || trade.resultKind === resultFilter) &&
          (dateFrom === '' || date >= dateFrom) &&
          (dateTo === '' || date <= dateTo)
        );
      }),
    [accountFilterIds, assetFilterIds, dateFrom, dateTo, includeUnassigned, resultFilter, trades],
  );
  const filteredTradeIds = useMemo(() => filteredTrades.map((trade) => trade.id), [filteredTrades]);
  const filteredCashMovements = useMemo(
    () =>
      cashMovements.filter((movement) => {
        const date = getDatePart(movement.occurredAt);
        return (
          assetFilterIds.length === 0 &&
          (accountFilterIds.length === 0 || accountFilterIds.includes(movement.accountId)) &&
          (dateFrom === '' || date >= dateFrom) &&
          (dateTo === '' || date <= dateTo)
        );
      }),
    [accountFilterIds, assetFilterIds, cashMovements, dateFrom, dateTo],
  );
  const entries = useMemo(
    () => toJournalEntryRows(filteredTrades, filteredCashMovements, showCashMovements),
    [filteredCashMovements, filteredTrades, showCashMovements],
  );

  const columns = useMemo(
    () =>
      createTradeTableColumns({
        labels: {
          account: t(TRANSLATION_KEYS.fieldAccount),
          accountUnassigned: t(TRANSLATION_KEYS.accountUnassigned),
          asset: t(TRANSLATION_KEYS.fieldAsset),
          date: t(TRANSLATION_KEYS.fieldDate),
          dateTime: t(TRANSLATION_KEYS.fieldDateTime),
          direction: t(TRANSLATION_KEYS.fieldDirection),
          directionLong: t(TRANSLATION_KEYS.tradeDirectionLong),
          directionShort: t(TRANSLATION_KEYS.tradeDirectionShort),
          deposit: t(TRANSLATION_KEYS.accountDeposit),
          withdrawal: t(TRANSLATION_KEYS.accountWithdrawal),
          notApplicable: t(TRANSLATION_KEYS.tableNotApplicable),
          identifier: t(TRANSLATION_KEYS.fieldIdentifier),
          result: t(TRANSLATION_KEYS.fieldResult),
          selectAll: t(TRANSLATION_KEYS.tableSelectAll),
          selectRow: t(TRANSLATION_KEYS.tableSelectRow),
          unit: t(TRANSLATION_KEYS.fieldUnit),
          unitCash: t(TRANSLATION_KEYS.tradeUnitCash),
          unitPercent: t(TRANSLATION_KEYS.tradeUnitPercent),
          unitR: t(TRANSLATION_KEYS.tradeUnitR),
        },
        tradePreferences,
      }),
    [t, tradePreferences],
  );

  const controller = useDataTableController({
    columns,
    data: entries,
    defaultColumns: DEFAULT_TRADE_TABLE_COLUMNS,
    defaultMode: DEFAULT_TRADE_TABLE_MODE,
    getColumnsForMode: getTradeTableVisibility,
    getRowId: (entry) => entry.id,
    isDataColumn: isTradeTableDataColumn,
    layout,
    layoutId: TABLE_IDENTIFIERS.trades,
    normalizeColumnOrder: normalizeTradeTableColumnOrder,
    onLayoutChange,
    sizeLimits: TRADE_TABLE_COLUMN_SIZE_LIMITS,
  });

  return {
    applyLayout: controller.applyLayout,
    activeFilterColumnId: controller.activeFilterColumnId,
    assetFilterIds,
    accountFilterIds,
    accountOptions,
    assetOptions,
    columns: controller.columnControls,
    clearSelection: controller.clearSelection,
    dateFrom,
    dateTo,
    filteredTradeIds,
    mode: controller.mode,
    resultFilter,
    showCashMovements,
    selectedCount: controller.selectedRows.length,
    selectedCashMovement:
      controller.selectedRows.length === 1 && controller.selectedRows[0]?.kind !== 'trade'
        ? (controller.selectedRows[0]?.movement ?? null)
        : null,
    selectedCashMovementIds: controller.selectedRows
      .filter((row) => row.kind !== 'trade')
      .map((row) => row.movement.id),
    selectedTrade:
      controller.selectedRows.length === 1 && controller.selectedRows[0]?.kind === 'trade'
        ? (controller.selectedRows[0]?.trade ?? null)
        : null,
    selectedTradeIds: controller.selectedRows
      .filter((row) => row.kind === 'trade')
      .map((row) => row.trade.id),
    setDateFrom,
    setDateTo,
    setAssetFilterIds,
    setAccountFilterIds,
    setIncludeUnassigned,
    includeUnassigned,
    setMode: controller.setMode,
    setResultFilter,
    setShowCashMovements,
    table: controller.table,
    toggleColumn: controller.toggleColumn,
    setActiveFilter: controller.setActiveFilter,
  };
};
