import type { LegacyColumnDef } from '@tanstack/react-table/legacy';
import { classifyTradeResult } from '@tjournal/trade/calculations';
import Decimal from 'decimal.js';

import type {
  InstrumentCategory,
  TagDto,
  TradeDto,
  TradePreferencesDto,
} from '../../../shared/desktop-api';
import { Checkbox } from '../../components/ui/checkbox';
import { TagOverflowList } from './tag-overflow-list';
import { getJournalEntryAmountUsd } from './trade-table-filters';
import type { JournalEntryRow } from './journal-entry-row';
import {
  TRADE_RESULT_FILTERS,
  TRADE_TABLE_COLUMN_IDS,
  isTradeTableSortableColumn,
} from './trade-table.config';
export interface TradeTableColumnLabels {
  readonly account: string;
  readonly accountUnassigned: string;
  readonly asset: string;
  readonly assetCategory: string;
  readonly date: string;
  readonly dateTime: string;
  readonly identifier: string;
  readonly direction: string;
  readonly directionLong: string;
  readonly directionShort: string;
  readonly deposit: string;
  readonly withdrawal: string;
  readonly notAvailable: string;
  readonly notApplicable: string;
  readonly selectAll: string;
  readonly selectRow: string;
  readonly unit: string;
  readonly unitCash: string;
  readonly unitPercent: string;
  readonly unitR: string;
  readonly result: string;
  readonly resultUnit: string;
  readonly tags: string;
  readonly tagsEmpty: string;
}

interface TradeTableColumnOptions {
  /** Instrument id to its category, so a trade row can show the asset type. */
  readonly assetCategories: ReadonlyMap<string, InstrumentCategory>;
  readonly categoryLabels: Readonly<Record<InstrumentCategory, string>>;
  readonly labels: TradeTableColumnLabels;
  /** Localized `+N` label; kept as a formatter because it interpolates a count. */
  readonly tagOverflowLabel: (hiddenCount: number) => string;
  /** Tag id to its catalogue entry, so a trade row can resolve its assignments. */
  readonly tags: ReadonlyMap<string, TagDto>;
  readonly tradePreferences: TradePreferencesDto;
}

const unitLabel = (labels: TradeTableColumnLabels, kind: TradeDto['resultKind']): string =>
  kind === TRADE_RESULT_FILTERS.cash
    ? labels.unitCash
    : kind === TRADE_RESULT_FILTERS.percent
      ? labels.unitPercent
      : labels.unitR;

const resolveTradeTags = (
  entry: JournalEntryRow,
  tags: ReadonlyMap<string, TagDto>,
): readonly TagDto[] => {
  if (entry.kind !== 'trade') return [];
  return (entry.trade.tagIds ?? [])
    .map((id) => tags.get(id))
    .filter((tag): tag is TagDto => tag !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const createTradeTableColumns = ({
  assetCategories,
  categoryLabels,
  labels,
  tagOverflowLabel,
  tags,
  tradePreferences,
}: TradeTableColumnOptions): readonly LegacyColumnDef<JournalEntryRow>[] => {
  const columns: readonly LegacyColumnDef<JournalEntryRow>[] = [
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
          if (direction === null) return labels.notApplicable;
          return (
            <span className={`trade-direction entry-type-entry entry-type-${direction}`}>
              {direction === 'long' ? labels.directionLong : labels.directionShort}
            </span>
          );
        }
        const entryKind = row.original.kind;
        return (
          <span className={`trade-direction entry-type-entry entry-type-${entryKind}`}>
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
        entry.kind === 'trade' ? (assetCategories.get(entry.trade.instrumentId) ?? '') : '',
      header: labels.assetCategory,
      id: TRADE_TABLE_COLUMN_IDS.assetCategory,
      cell: ({ row }) => {
        if (row.original.kind !== 'trade') return labels.notApplicable;
        const category = assetCategories.get(row.original.trade.instrumentId);
        return category === undefined ? labels.notAvailable : categoryLabels[category];
      },
    },
    {
      /*
       * Authoritative USD column. Percent and R entries are converted exactly once
       * on save (ADR-0004); unresolved legacy rows are shown as unavailable instead
       * of being rebased on today's balance.
       */
      accessorFn: (entry) => getJournalEntryAmountUsd(entry) ?? '',
      header: labels.result,
      id: TRADE_TABLE_COLUMN_IDS.result,
      cell: ({ row }) => {
        const amountUsd = getJournalEntryAmountUsd(row.original);
        if (amountUsd === null) {
          return (
            <span className="trade-result trade-result-unavailable">{labels.notAvailable}</span>
          );
        }
        const tone =
          row.original.kind === 'trade'
            ? (classifyTradeResult(row.original.trade, {
                metric: 'cash',
                neutralCostSettings: tradePreferences.neutralCostSettings,
                neutralRange: tradePreferences.neutralRanges.cash,
              }) ?? 'neutral')
            : row.original.kind === 'deposit'
              ? 'positive'
              : 'negative';
        return (
          <span
            className={`trade-result ui-numeric trade-result-${tone}`}
          >{`${amountUsd} ${labels.unitCash}`}</span>
        );
      },
      sortFn: (firstRow, secondRow) => {
        const first = getJournalEntryAmountUsd(firstRow.original);
        const second = getJournalEntryAmountUsd(secondRow.original);
        if (first === null || second === null) {
          return firstRow.original.occurredAt.localeCompare(secondRow.original.occurredAt);
        }
        return new Decimal(first).comparedTo(second);
      },
    },
    {
      accessorFn: (entry) =>
        entry.kind === 'trade' ? (entry.trade.inputResultKind ?? entry.trade.resultKind) : 'cash',
      header: labels.resultUnit,
      id: TRADE_TABLE_COLUMN_IDS.resultKind,
      cell: ({ row }) => {
        if (row.original.kind !== 'trade') return labels.notApplicable;
        return unitLabel(
          labels,
          row.original.trade.inputResultKind ?? row.original.trade.resultKind,
        );
      },
    },
    {
      accessorFn: (entry) =>
        resolveTradeTags(entry, tags)
          .map((tag) => tag.name)
          .join(' '),
      header: labels.tags,
      id: TRADE_TABLE_COLUMN_IDS.tags,
      cell: ({ row }) => {
        if (row.original.kind !== 'trade') return labels.notApplicable;
        return (
          <TagOverflowList
            emptyLabel={labels.tagsEmpty}
            showMoreLabel={tagOverflowLabel}
            tags={resolveTradeTags(row.original, tags)}
          />
        );
      },
    },
    {
      accessorKey: 'id',
      header: labels.identifier,
      id: TRADE_TABLE_COLUMN_IDS.id,
    },
  ];
  return columns.map((column) => ({
    ...column,
    enableSorting: column.id !== undefined && isTradeTableSortableColumn(column.id),
  }));
};
