import type { LegacyColumnDef } from '@tanstack/react-table/legacy';
import { classifyTradeResult } from '@tjournal/trade/calculations';
import Decimal from 'decimal.js';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

import type {
  InstrumentCategory,
  TagDto,
  TradeDto,
  TradePreferencesDto,
} from '../../../shared/desktop-api';
import { Checkbox } from '../../components/ui/checkbox';
import { TRANSLATION_KEYS } from '../../i18n-keys';
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
  readonly commission: string;
  readonly date: string;
  readonly dateTime: string;
  readonly entryPrice: string;
  readonly entryNote: string;
  readonly exitCount: string;
  readonly identifier: string;
  readonly direction: string;
  readonly directionLong: string;
  readonly directionShort: string;
  readonly deposit: string;
  readonly withdrawal: string;
  readonly notes: string;
  readonly notAvailable: string;
  readonly notApplicable: string;
  readonly quantityLots: string;
  readonly reviewNote: string;
  readonly reviewReviewed: string;
  readonly reviewStatus: string;
  readonly reviewUnreviewed: string;
  readonly spreadTicks: string;
  readonly stopLoss: string;
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

/** Builds the localized labels once, so the presenter does not repeat the map. */
export const createTradeTableColumnLabels = (
  t: (key: string) => string,
): TradeTableColumnLabels => ({
  account: t(TRANSLATION_KEYS.fieldAccount),
  accountUnassigned: t(TRANSLATION_KEYS.accountUnassigned),
  asset: t(TRANSLATION_KEYS.fieldAsset),
  assetCategory: t(TRANSLATION_KEYS.fieldAssetType),
  commission: t(TRANSLATION_KEYS.fieldCommission),
  date: t(TRANSLATION_KEYS.fieldDate),
  dateTime: t(TRANSLATION_KEYS.fieldDateTime),
  direction: t(TRANSLATION_KEYS.fieldType),
  directionLong: t(TRANSLATION_KEYS.tradeDirectionLong),
  directionShort: t(TRANSLATION_KEYS.tradeDirectionShort),
  deposit: t(TRANSLATION_KEYS.accountDeposit),
  withdrawal: t(TRANSLATION_KEYS.accountWithdrawal),
  entryNote: t(TRANSLATION_KEYS.tradeEntryNote),
  entryPrice: t(TRANSLATION_KEYS.fieldEntryPrice),
  exitCount: t(TRANSLATION_KEYS.fieldExitCount),
  notes: t(TRANSLATION_KEYS.fieldNotes),
  notApplicable: t(TRANSLATION_KEYS.tableNotApplicable),
  notAvailable: t(TRANSLATION_KEYS.tableNotApplicable),
  identifier: t(TRANSLATION_KEYS.fieldIdentifier),
  quantityLots: t(TRANSLATION_KEYS.fieldQuantityLots),
  result: t(TRANSLATION_KEYS.fieldResult),
  resultUnit: t(TRANSLATION_KEYS.fieldUnit),
  reviewNote: t(TRANSLATION_KEYS.tradeReviewNote),
  reviewReviewed: t(TRANSLATION_KEYS.tradeReviewReviewed),
  reviewStatus: t(TRANSLATION_KEYS.tradeReviewStatus),
  reviewUnreviewed: t(TRANSLATION_KEYS.tradeReviewUnreviewed),
  spreadTicks: t(TRANSLATION_KEYS.fieldSpreadTicks),
  stopLoss: t(TRANSLATION_KEYS.fieldStopLoss),
  selectAll: t(TRANSLATION_KEYS.tableSelectAll),
  selectRow: t(TRANSLATION_KEYS.tableSelectRow),
  tags: t(TRANSLATION_KEYS.fieldTag),
  tagsEmpty: t(TRANSLATION_KEYS.tagEmpty),
  unit: t(TRANSLATION_KEYS.fieldUnit),
  unitCash: t(TRANSLATION_KEYS.tradeUnitCash),
  unitPercent: t(TRANSLATION_KEYS.tradeUnitPercent),
  unitR: t(TRANSLATION_KEYS.tradeUnitR),
});

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
              {direction === 'long' ? (
                <ArrowUpRight aria-hidden="true" />
              ) : (
                <ArrowDownRight aria-hidden="true" />
              )}
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
    /*
     * Detail columns project the bounded trade-detail fields carried with the
     * page row. A trade without an execution shows "not applicable" instead of
     * a misleading zero.
     */
    {
      accessorFn: (entry) => (entry.kind === 'trade' ? (entry.trade.entryPrice ?? '') : ''),
      header: labels.entryPrice,
      id: TRADE_TABLE_COLUMN_IDS.entryPrice,
      cell: ({ row }) =>
        row.original.kind === 'trade' && row.original.trade.entryPrice !== null
          ? row.original.trade.entryPrice
          : labels.notApplicable,
    },
    {
      accessorFn: (entry) => (entry.kind === 'trade' ? (entry.trade.stopLossPrice ?? '') : ''),
      header: labels.stopLoss,
      id: TRADE_TABLE_COLUMN_IDS.stopLoss,
      cell: ({ row }) =>
        row.original.kind === 'trade' && row.original.trade.stopLossPrice !== null
          ? row.original.trade.stopLossPrice
          : labels.notApplicable,
    },
    {
      accessorFn: (entry) => (entry.kind === 'trade' ? (entry.trade.quantityLots ?? '') : ''),
      header: labels.quantityLots,
      id: TRADE_TABLE_COLUMN_IDS.quantityLots,
      cell: ({ row }) =>
        row.original.kind === 'trade' && row.original.trade.quantityLots !== null
          ? row.original.trade.quantityLots
          : labels.notApplicable,
    },
    {
      accessorFn: (entry) => (entry.kind === 'trade' ? (entry.trade.commissionUsd ?? '') : ''),
      header: labels.commission,
      id: TRADE_TABLE_COLUMN_IDS.commissionUsd,
      cell: ({ row }) =>
        row.original.kind === 'trade' && row.original.trade.commissionUsd !== null
          ? `${row.original.trade.commissionUsd} ${labels.unitCash}`
          : labels.notApplicable,
    },
    {
      accessorFn: (entry) => (entry.kind === 'trade' ? (entry.trade.spreadTicks ?? '') : ''),
      header: labels.spreadTicks,
      id: TRADE_TABLE_COLUMN_IDS.spreadTicks,
      cell: ({ row }) =>
        row.original.kind === 'trade' && row.original.trade.spreadTicks !== null
          ? row.original.trade.spreadTicks
          : labels.notApplicable,
    },
    {
      accessorFn: (entry) => (entry.kind === 'trade' ? entry.trade.exitCount : 0),
      header: labels.exitCount,
      id: TRADE_TABLE_COLUMN_IDS.exitCount,
      cell: ({ row }) => {
        if (row.original.kind !== 'trade' || row.original.trade.entryPrice === null) {
          return labels.notApplicable;
        }
        return String(row.original.trade.exitCount);
      },
    },
    {
      accessorFn: (entry) => (entry.kind === 'trade' ? entry.trade.reviewStatus : ''),
      header: labels.reviewStatus,
      id: TRADE_TABLE_COLUMN_IDS.reviewStatus,
      cell: ({ row }) => {
        if (row.original.kind !== 'trade') return labels.notApplicable;
        return row.original.trade.reviewStatus === 'reviewed'
          ? labels.reviewReviewed
          : labels.reviewUnreviewed;
      },
    },
    {
      accessorFn: (entry) =>
        entry.kind === 'trade'
          ? `${entry.trade.hasEntryNote ? 'entry' : ''} ${entry.trade.hasReviewNote ? 'review' : ''}`
          : '',
      header: labels.notes,
      id: TRADE_TABLE_COLUMN_IDS.notes,
      cell: ({ row }) => {
        if (row.original.kind !== 'trade') return labels.notApplicable;
        const present = [
          row.original.trade.hasEntryNote ? labels.entryNote : null,
          row.original.trade.hasReviewNote ? labels.reviewNote : null,
        ].filter((value): value is string => value !== null);
        return present.length === 0 ? labels.notAvailable : present.join(', ');
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
