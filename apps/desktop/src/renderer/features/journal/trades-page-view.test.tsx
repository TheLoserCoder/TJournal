import { useLegacyTable, type LegacyColumnDef } from '@tanstack/react-table/legacy';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CashMovementDto, TradeDto } from '../../../shared/desktop-api';
import { i18n } from '../../i18n';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { createEmptyNumberFilterState } from '../../components/ui/number-filter-state';
import { createEmptyDateTimeRangeFilterState } from '../../components/ui/datetime-range-filter-state';
import type { JournalEntryRow } from './journal-entry-row';
import type { TradesTablePresenter } from './use-trades-table-presenter';
import type { TradeSummaryPresenter } from './use-trade-summary-presenter';
import { TradesPageView } from './trades-page-view';

const TEST_COLUMNS: readonly LegacyColumnDef<JournalEntryRow>[] = [
  { accessorFn: (entry) => entry.id, header: 'Entry', id: 'entry', size: 200 },
];
const TEST_TRADE: TradeDto = {
  account: null,
  closedAt: '2026-09-13T12:00:00.000Z',
  direction: 'long',
  entryNote: null,
  execution: null,
  id: 'trade-1',
  instrumentId: 'instrument-1',
  instrumentSymbol: 'EURUSD',
  resultKind: 'cash',
  resultSource: 'manual',
  resultValue: '100',
  reviewNote: null,
  reviewStatus: 'unreviewed',
  riskBindingSnapshot: null,
  tagIds: [],
};
const TEST_MOVEMENT: CashMovementDto = {
  accountId: 'account-1',
  accountName: 'Main',
  amountUsd: '500',
  id: 'movement-1',
  kind: 'deposit',
  occurredAt: '2026-09-14T10:00:00.000Z',
};
const TEST_ENTRIES: readonly JournalEntryRow[] = [
  { id: 'trade:trade-1', kind: 'trade', occurredAt: TEST_TRADE.closedAt, trade: TEST_TRADE },
  {
    id: 'cash-movement:movement-1',
    kind: 'deposit',
    movement: TEST_MOVEMENT,
    occurredAt: TEST_MOVEMENT.occurredAt,
  },
];
const createFilters = (): TradesTablePresenter['filters'] => ({
  accountFilterIds: [],
  accountIncludeUnassigned: false,
  active: false,
  assetCategoryFilters: [],
  assetFilterIds: [],
  dateFrom: '',
  dateTo: '',
  dateTimeRange: createEmptyDateTimeRangeFilterState(),
  entryFilterOptions: [],
  entryFilters: [],
  reset: vi.fn(),
  resultBounds: createEmptyNumberFilterState(),
  resultUnit: 'all',
  resultUnitOptions: [],
  setAccountFilterIds: vi.fn(),
  setAccountIncludeUnassigned: vi.fn(),
  setAssetCategoryFilters: vi.fn(),
  setAssetFilterIds: vi.fn(),
  setDateFrom: vi.fn(),
  setDateTo: vi.fn(),
  setDateTimeRange: vi.fn(),
  setEntryFilters: vi.fn(),
  setResultBounds: vi.fn(),
  setResultUnit: vi.fn(),
  setTagFilterIds: vi.fn(),
  setTagIncludeUntagged: vi.fn(),
  setTextQuery: vi.fn(),
  tagFilterIds: [],
  tagIncludeUntagged: false,
  textQuery: '',
});

const createTablePresenter = (
  table: TradesTablePresenter['table'],
  overrides: Partial<TradesTablePresenter> = {},
): TradesTablePresenter => {
  return {
    accountOptions: [],
    activeFilterColumnId: null,
    applyLayout: vi.fn(),
    assetCategoryOptions: [],
    assetOptions: [],
    clearSelection: vi.fn(),
    columns: [],
    entries: [],
    filteredTradeIds: [],
    hasEntries: false,
    hasMore: false,
    hasPrevious: false,
    filters: createFilters(),
    loading: false,
    loadMore: vi.fn(),
    loadPrevious: vi.fn(),
    mode: 'compact',
    recentInstrumentIds: [],
    selectedCashMovement: null,
    selectedCashMovementIds: [],
    selectedCount: 0,
    selectedTrade: null,
    selectedTradeIds: [],
    setActiveFilter: vi.fn(),
    setMode: vi.fn(),
    setShowCashMovements: vi.fn(),
    showCashMovements: true,
    table,
    tagOptions: [],
    toggleColumn: vi.fn(),
    unassignedTradeCount: 0,
    virtualRowCount: TEST_ENTRIES.length,
    virtualRowStartIndex: 0,
    ...overrides,
  };
};

const createSummaryPresenter = (): TradeSummaryPresenter => ({
  closeSettings: vi.fn(),
  followTableFilters: false,
  metric: 'cash',
  openSettings: vi.fn(),
  period: 'all',
  setFollowTableFilters: vi.fn(),
  setMetric: vi.fn(),
  setPeriod: vi.fn(),
  settingsOpen: false,
  summary: null,
  summaryRefreshing: false,
});

interface TradesHarnessOptions {
  readonly accountId?: string | null;
  readonly entries?: readonly JournalEntryRow[];
  readonly entryKind?: 'trade' | 'deposit' | 'withdrawal';
  readonly onEditTrade?: (tradeId: string) => void;
  readonly overrides?: Partial<TradesTablePresenter>;
  readonly percentBaseUsd?: string | null;
  readonly resultKind?: TradeDto['resultKind'];
  readonly resultPreviewUsd?: string | null;
  readonly symbol?: string;
}

const TradesHarness = ({
  accountId = null,
  entries = [],
  entryKind = 'trade',
  onEditTrade = vi.fn(),
  overrides,
  percentBaseUsd = null,
  resultKind = 'cash',
  resultPreviewUsd = null,
  symbol = '',
}: TradesHarnessOptions): ReactElement => {
  const table = useLegacyTable({
    columns: TEST_COLUMNS,
    data: entries,
    getRowId: (row) => row.id,
  });
  return (
    <I18nextProvider i18n={i18n}>
      <TradesPageView
        accountId={accountId}
        accounts={[]}
        direction="long"
        entryKind={entryKind}
        instruments={[]}
        legacyLookupEmpty={false}
        legacyUnassignedCount={0}
        movementAmount=""
        onAccountChange={vi.fn()}
        onCashMovementUpdate={vi.fn().mockResolvedValue(true)}
        onCreate={vi.fn()}
        onDirectionChange={vi.fn()}
        onEditTrade={onEditTrade}
        onEntryKindChange={vi.fn()}
        onMovementAmountChange={vi.fn()}
        onOpenDetails={vi.fn()}
        onOpenLegacyMigration={vi.fn()}
        onOpenTableLayout={vi.fn()}
        onResultKindChange={vi.fn()}
        onResultValueChange={vi.fn()}
        onSelectedDelete={vi.fn()}
        onSymbolChange={vi.fn()}
        createAssetLabel={(value) => value}
        createTagLabel={(name) => name}
        onCreateTag={vi.fn().mockResolvedValue(undefined)}
        onTagIdsChange={vi.fn()}
        percentBaseUsd={percentBaseUsd}
        resultKind={resultKind}
        resultPreviewUsd={resultPreviewUsd}
        resultValue=""
        summaryPresenter={createSummaryPresenter()}
        symbol={symbol}
        tagIds={[]}
        tags={[]}
        tablePresenter={createTablePresenter(table, overrides)}
      />
    </I18nextProvider>
  );
};

const renderTrades = (options: TradesHarnessOptions = {}): void => {
  render(<TradesHarness {...options} />);
};

const readLayer = (index: 0 | 1): HTMLElement => {
  const layer = document.querySelectorAll<HTMLElement>('.trades-entry-layer')[index];
  if (layer === undefined) throw new Error(`Missing action layer at index ${index}`);
  return layer;
};

const readRow = (rowId: string): HTMLElement => {
  const row = screen.getByText(rowId).closest('tr');
  if (row === null) throw new Error(`Missing row for ${rowId}`);
  return row;
};

describe('TradesPageView action layers', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    await i18n.changeLanguage('ru');
  });

  it('keeps both layers mounted and marks the inactive one inert', () => {
    renderTrades();

    const entry = readLayer(0);
    const selection = readLayer(1);

    expect(entry).toHaveAttribute('data-active', 'true');
    expect(entry).not.toHaveAttribute('inert');
    expect(entry).not.toHaveAttribute('aria-hidden');

    expect(selection).toHaveAttribute('data-active', 'false');
    expect(selection).toHaveAttribute('inert');
    expect(selection).toHaveAttribute('aria-hidden', 'true');
  });

  it('switches layers when rows are selected without losing the entry form', () => {
    renderTrades({ overrides: { selectedCount: 2 } });

    const entry = readLayer(0);
    const selection = readLayer(1);

    expect(entry).toHaveAttribute('data-active', 'false');
    expect(entry).toHaveAttribute('inert');
    expect(selection).toHaveAttribute('data-active', 'true');
    expect(selection).not.toHaveAttribute('inert');

    expect(
      screen.getByText(i18n.t(TRANSLATION_KEYS.tableSelectedCount, { count: 2 })),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionClearSelection) }),
    ).toBeVisible();
  });

  it('exposes the entry form controls only in the active layer', () => {
    renderTrades();

    expect(
      screen.getByRole('combobox', { name: i18n.t(TRANSLATION_KEYS.tableEntryType) }),
    ).toBeVisible();
    expect(
      screen.queryByText(i18n.t(TRANSLATION_KEYS.tableSelectedCount, { count: 0 })),
    ).not.toBeInTheDocument();
  });

  it('renders the global filter reset only while a filter is applied', () => {
    renderTrades();

    expect(
      screen.queryByRole('button', { name: i18n.t(TRANSLATION_KEYS.tableFilterResetAll) }),
    ).not.toBeInTheDocument();

    cleanup();
    renderTrades({ overrides: { filters: { ...createFilters(), active: true } } });

    expect(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.tableFilterResetAll) }),
    ).toBeVisible();
  });

  it('opens the trade editor when a trade row is double-clicked', () => {
    const onEditTrade = vi.fn();
    renderTrades({ entries: TEST_ENTRIES, onEditTrade });

    fireEvent.doubleClick(readRow('trade:trade-1'));

    expect(onEditTrade).toHaveBeenCalledWith(TEST_TRADE.id);
  });

  it('opens the cash movement editor when a movement row is double-clicked', async () => {
    renderTrades({ entries: TEST_ENTRIES });

    fireEvent.doubleClick(readRow('cash-movement:movement-1'));

    expect(
      await screen.findByText(i18n.t(TRANSLATION_KEYS.tableCashMovements)),
    ).toBeInTheDocument();
  });

  it('edits the selected trade from the selection toolbar', () => {
    const onEditTrade = vi.fn();
    renderTrades({
      onEditTrade,
      overrides: { selectedCount: 1, selectedTrade: TEST_TRADE },
    });

    fireEvent.click(screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionEdit) }));

    expect(onEditTrade).toHaveBeenCalledWith(TEST_TRADE.id);
  });

  it('shows the converted USD result inside the entry toolbar', () => {
    renderTrades({ percentBaseUsd: '1250', resultKind: 'percent', resultPreviewUsd: '125.5' });

    expect(
      screen.getByText(
        i18n.t(TRANSLATION_KEYS.tradeConversionPreview, { unit: 'USD', value: '125,5' }),
      ),
    ).toBeVisible();
  });

  it('reserves no conversion space while no result is entered', () => {
    renderTrades();

    expect(document.querySelector('.quick-entry-conversion')).toBeNull();
  });

  it('drops the conversion track while no percent/R preview is shown', () => {
    renderTrades();

    const fields = document.querySelector('.trades-topbar-fields');
    expect(fields).toHaveAttribute('data-conversion', 'false');
    expect(fields).toHaveAttribute('data-entry-kind', 'trade');
  });

  it('adds the conversion track for a percent preview', () => {
    renderTrades({ percentBaseUsd: '1250', resultKind: 'percent', resultPreviewUsd: '125.5' });

    expect(document.querySelector('.trades-topbar-fields')).toHaveAttribute(
      'data-conversion',
      'true',
    );
  });

  it('keeps only the three movement fields for a deposit', () => {
    renderTrades({ entryKind: 'deposit' });

    expect(document.querySelector('.trades-topbar-fields')).toHaveAttribute(
      'data-entry-kind',
      'movement',
    );
    expect(document.querySelector('.quick-entry-control-asset')).toBeNull();
    expect(document.querySelector('.quick-entry-control-tags')).toBeNull();
  });

  it('disables Add while a trade has no asset and enables it with a symbol', () => {
    renderTrades({ accountId: 'account-1' });
    expect(screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionAdd) })).toBeDisabled();

    cleanup();
    renderTrades({ accountId: 'account-1', symbol: 'EURUSD' });
    expect(screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionAdd) })).toBeEnabled();
  });

  it('keeps the percent base out of the under-toolbar feedback', () => {
    renderTrades({ percentBaseUsd: '1250', resultKind: 'percent', resultPreviewUsd: '125.5' });

    expect(
      screen.queryByText(i18n.t(TRANSLATION_KEYS.tradePercentBase, { value: '1250' })),
    ).not.toBeInTheDocument();
  });

  it('distinguishes an empty journal from an empty filter result', () => {
    renderTrades({ overrides: { hasEntries: false } });
    expect(screen.getByText(i18n.t(TRANSLATION_KEYS.journalEmpty))).toBeVisible();

    cleanup();
    renderTrades({ overrides: { hasEntries: true } });
    expect(screen.getByText(i18n.t(TRANSLATION_KEYS.tableEmpty))).toBeVisible();
  });
});
