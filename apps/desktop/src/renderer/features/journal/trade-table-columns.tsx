import type { LegacyColumnDef } from '@tanstack/react-table/legacy';
import { classifyTradeResult } from '@tjournal/trade/calculations';
import Decimal from 'decimal.js';

import type { TradeDto, TradePreferencesDto } from '../../../shared/desktop-api';
import { Checkbox } from '../../components/ui/checkbox';
import type { JournalEntryRow } from './journal-entry-row';
import { TRADE_RESULT_FILTERS, TRADE_TABLE_COLUMN_IDS } from './trade-table.config';

export interface TradeTableColumnLabels {
  readonly account: string;
  readonly accountUnassigned: string;
  readonly asset: string;
  readonly date: string;
  readonly dateTime: string;
  readonly identifier: string;
  readonly direction: string;
  readonly directionLong: string;
  readonly directionShort: string;
  readonly deposit: string;
  readonly withdrawal: string;
  readonly notApplicable: string;
  readonly selectAll: string;
  readonly selectRow: string;
  readonly unit: string;
  readonly unitCash: string;
  readonly unitPercent: string;
  readonly unitR: string;
  readonly result: string;
}

interface TradeTableColumnOptions {
  readonly labels: TradeTableColumnLabels;
  readonly tradePreferences: TradePreferencesDto;
}

export const createTradeTableColumns = ({
  labels,
  tradePreferences,
}: TradeTableColumnOptions): readonly LegacyColumnDef<JournalEntryRow>[] => [
  {
    accessorFn: (entry) =>
      entry.kind === 'trade'
        ? (entry.trade.account?.accountName ?? '')
        : entry.movement.accountName,
    header: labels.account,
    id: TRADE_TABLE_COLUMN_IDS.account,
    cell: ({ row }) =>
      row.original.kind === 'trade'
        ? (row.original.trade.account?.accountName ?? labels.accountUnassigned)
        : row.original.movement.accountName,
  },
  {
    accessorFn: (entry) => entry.kind,
    header: labels.direction,
    id: TRADE_TABLE_COLUMN_IDS.direction,
    cell: ({ row }) => {
      if (row.original.kind === 'trade') {
        const direction = row.original.trade.direction;
        if (direction === null) return null;
        return (
          <span className={`trade-direction trade-direction-${direction}`}>
            {direction === 'long' ? labels.directionLong : labels.directionShort}
          </span>
        );
      }
      const entryKind = row.original.kind;
      return (
        <span className={`trade-direction trade-direction-${entryKind}`}>
          {entryKind === 'deposit' ? labels.deposit : labels.withdrawal}
        </span>
      );
    },
  },
  {
    enableResizing: false,
    enableSorting: false,
    header: ({ table }) => (
      <Checkbox
        ariaLabel={labels.selectAll}
        checked={table.getIsAllRowsSelected()}
        onCheckedChange={(checked) => table.toggleAllRowsSelected(checked)}
      />
    ),
    id: TRADE_TABLE_COLUMN_IDS.selection,
    size: 48,
    cell: ({ row }) => (
      <Checkbox
        ariaLabel={labels.selectRow}
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(checked)}
      />
    ),
  },
  {
    accessorKey: 'occurredAt',
    header: labels.date,
    id: TRADE_TABLE_COLUMN_IDS.closedAt,
    cell: ({ getValue }) => new Date(getValue<string>()).toLocaleDateString(),
  },
  {
    accessorKey: 'occurredAt',
    header: labels.dateTime,
    id: TRADE_TABLE_COLUMN_IDS.closedAtTime,
    cell: ({ getValue }) => new Date(getValue<string>()).toLocaleString(),
  },
  {
    accessorFn: (entry) => (entry.kind === 'trade' ? entry.trade.instrumentSymbol : ''),
    header: labels.asset,
    id: TRADE_TABLE_COLUMN_IDS.asset,
    cell: ({ row }) =>
      row.original.kind === 'trade' ? row.original.trade.instrumentSymbol : labels.notApplicable,
  },
  {
    accessorFn: (entry) =>
      entry.kind === 'trade' ? entry.trade.resultValue : entry.movement.amountUsd,
    header: labels.result,
    id: TRADE_TABLE_COLUMN_IDS.result,
    cell: ({ row }) => {
      if (row.original.kind !== 'trade') {
        const amount = new Decimal(row.original.movement.amountUsd);
        const signedAmount = row.original.kind === 'deposit' ? amount : amount.negated();
        const tone = row.original.kind === 'deposit' ? 'positive' : 'negative';
        return (
          <span
            className={`trade-result trade-result-${tone}`}
          >{`${signedAmount.toString()} ${labels.unitCash}`}</span>
        );
      }
      const result = new Decimal(row.original.trade.resultValue);
      const tone =
        classifyTradeResult(row.original.trade, {
          metric: row.original.trade.resultKind,
          neutralCostSettings: tradePreferences.neutralCostSettings,
          neutralRange: tradePreferences.neutralRanges[row.original.trade.resultKind],
        }) ?? (result.isPositive() ? 'positive' : result.isNegative() ? 'negative' : 'neutral');
      const unit =
        row.original.trade.resultKind === TRADE_RESULT_FILTERS.cash
          ? labels.unitCash
          : row.original.trade.resultKind === TRADE_RESULT_FILTERS.percent
            ? labels.unitPercent
            : labels.unitR;
      return (
        <span
          className={`trade-result trade-result-${tone}`}
        >{`${result.toString()} ${unit}`}</span>
      );
    },
    sortFn: (firstRow, secondRow) => {
      const firstTrade = firstRow.original.kind === 'trade' ? firstRow.original.trade : null;
      const secondTrade = secondRow.original.kind === 'trade' ? secondRow.original.trade : null;
      if (firstTrade === null || secondTrade === null) {
        return firstRow.original.occurredAt.localeCompare(secondRow.original.occurredAt);
      }
      if (firstTrade.resultKind !== secondTrade.resultKind) {
        return firstTrade.resultKind.localeCompare(secondTrade.resultKind);
      }
      return new Decimal(firstTrade.resultValue).comparedTo(secondTrade.resultValue);
    },
  },
  {
    accessorFn: (entry) => (entry.kind === 'trade' ? entry.trade.resultKind : 'cash'),
    header: labels.unit,
    id: TRADE_TABLE_COLUMN_IDS.resultKind,
    cell: ({ getValue }) =>
      getValue<TradeDto['resultKind']>() === TRADE_RESULT_FILTERS.cash
        ? labels.unitCash
        : getValue<TradeDto['resultKind']>() === TRADE_RESULT_FILTERS.percent
          ? labels.unitPercent
          : labels.unitR,
  },
  {
    accessorKey: 'id',
    header: labels.identifier,
    id: TRADE_TABLE_COLUMN_IDS.id,
  },
];
