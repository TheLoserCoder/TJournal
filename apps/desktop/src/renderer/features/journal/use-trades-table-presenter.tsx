import type { SortingState } from '@tanstack/react-table';
import type { LegacyReactTable } from '@tanstack/react-table/legacy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  TABLE_IDENTIFIERS,
  type AccountDto,
  type CashMovementDto,
  type InstrumentCategory,
  type InstrumentDto,
  type JournalPageDto,
  type JournalPageTradeDto,
  type JournalPageRequestDto,
  type TableDisplayMode,
  type TableLayoutDto,
  type TagDto,
  type TradePreferencesDto,
} from '../../../shared/desktop-api';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { useDataTableController } from '../../components/use-data-table-controller';
import { INSTRUMENT_CATEGORIES, INSTRUMENT_CATEGORY_LABEL_KEYS } from './entity-table.config';
import { buildJournalPageRequest, JOURNAL_PAGE_LIMIT } from './journal-page-query';
import {
  appendJournalPage,
  closeJournalPageWindowBoundary,
  createJournalPageWindow,
  getJournalPageWindowRows,
  prependJournalPage,
  type JournalPageWindow,
} from './journal-page-window';
import { createTradeTableColumnLabels, createTradeTableColumns } from './trade-table-columns';
import {
  createInitialTradeTableFilterState,
  hasActiveTradeTableFilters,
  TRADE_ENTRY_FILTERS,
  type TradeDetailBounds,
  type TradeEntryFilter,
  type TradeResultUnitFilter,
  type TradeReviewStatusFilter,
  type TradeTableFilterState,
} from './trade-table-filters';
import type { TradeDetailNumericField, TradeNotePresence } from './trade-table.config';
import type { JournalEntryRow } from './journal-entry-row';
import {
  DEFAULT_TRADE_TABLE_COLUMNS,
  normalizeTradeTableColumnOrder,
  DEFAULT_TRADE_TABLE_MODE,
  getTradeTableVisibility,
  isTradeTableDataColumn,
  TRADE_TABLE_COLUMN_SIZE_LIMITS,
} from './trade-table.config';

interface TradeTableColumnControl {
  readonly id: string;
  readonly label: string;
  readonly visible: boolean;
}

export interface TradeTableFiltersPresenter extends TradeTableFilterState {
  readonly active: boolean;
  readonly entryFilterOptions: readonly {
    readonly label: string;
    readonly value: TradeEntryFilter;
  }[];
  readonly resultUnitOptions: readonly {
    readonly label: string;
    readonly value: TradeResultUnitFilter;
  }[];
  reset(): void;
  setAccountFilterIds(ids: readonly string[]): void;
  setAccountIncludeUnassigned(value: boolean): void;
  setAssetCategoryFilters(values: readonly InstrumentCategory[]): void;
  setAssetFilterIds(ids: readonly string[]): void;
  setDateFrom(value: string): void;
  setDateTo(value: string): void;
  setDateTimeRange(range: TradeTableFilterState['dateTimeRange']): void;
  setDetailBounds(
    field: TradeDetailNumericField,
    bounds: TradeDetailBounds[TradeDetailNumericField],
  ): void;
  setEntryFilters(values: readonly TradeEntryFilter[]): void;
  setNotePresence(values: readonly TradeNotePresence[]): void;
  setResultBounds(bounds: TradeTableFilterState['resultBounds']): void;
  setResultUnit(value: TradeResultUnitFilter): void;
  setReviewStatuses(values: readonly TradeReviewStatusFilter[]): void;
  setTagFilterIds(ids: readonly string[]): void;
  setTagIncludeUntagged(value: boolean): void;
  setTextQuery(value: string): void;
}

export interface TradesTablePresenter {
  readonly accountOptions: readonly { readonly id: string; readonly label: string }[];
  readonly activeFilterColumnId: string | null;
  readonly assetCategoryOptions: readonly {
    readonly id: InstrumentCategory;
    readonly label: string;
  }[];
  readonly assetOptions: readonly { readonly id: string; readonly label: string }[];
  readonly columns: readonly TradeTableColumnControl[];
  readonly entries: readonly JournalEntryRow[];
  readonly filters: TradeTableFiltersPresenter;
  /** True while at least one more page exists on the server for the current query. */
  readonly hasMore: boolean;
  readonly hasPrevious: boolean;
  readonly loading: boolean;
  readonly mode: TableDisplayMode;
  readonly recentInstrumentIds: readonly string[];
  readonly selectedCount: number;
  readonly selectedCashMovement: CashMovementDto | null;
  readonly selectedCashMovementIds: readonly string[];
  /** True while the vault has any recorded entry, filter-independent. */
  readonly hasEntries: boolean;
  readonly selectedTrade: JournalPageTradeDto | null;
  readonly selectedTradeIds: readonly string[];
  readonly showCashMovements: boolean;
  readonly table: LegacyReactTable<JournalEntryRow>;
  readonly tagOptions: readonly { readonly id: string; readonly label: string }[];
  readonly filteredTradeIds: readonly string[];
  readonly unassignedTradeCount: number;
  readonly virtualRowCount: number;
  readonly virtualRowStartIndex: number;
  clearSelection(): void;
  applyLayout(
    mode: TableDisplayMode,
    columns: readonly { readonly id: string; readonly visible: boolean }[],
  ): void;
  loadMore(): void;
  loadPrevious(): void;
  setMode(value: TableDisplayMode): void;
  setShowCashMovements(value: boolean): void;
  toggleColumn(id: string): void;
  setActiveFilter(columnId: string | null): void;
}

interface UseTradesTablePresenterOptions {
  readonly accounts: readonly AccountDto[];
  readonly dataVersion: number;
  readonly instruments: readonly InstrumentDto[];
  readonly layout: TableLayoutDto | undefined;
  readonly loadPage: (input: JournalPageRequestDto) => Promise<JournalPageDto | null>;
  readonly onLayoutChange: (layout: TableLayoutDto) => void;
  readonly tags: readonly TagDto[];
  readonly tradePreferences: TradePreferencesDto;
}

/**
 * Orders the asset list by recent use: the first loaded journal page arrives in
 * date-descending order, so its instrument order is the recency order.
 */
export const orderInstrumentSelection = (
  instruments: readonly InstrumentDto[],
  recentInstrumentIds: readonly string[],
): readonly InstrumentDto[] => {
  const recencyRank = new Map(recentInstrumentIds.map((id, index) => [id, index]));
  return [...instruments].sort((left, right) => {
    const leftRank = recencyRank.get(left.id);
    const rightRank = recencyRank.get(right.id);
    if (leftRank !== undefined || rightRank !== undefined) {
      if (leftRank === undefined) return 1;
      if (rightRank === undefined) return -1;
      return (
        leftRank - rightRank ||
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

interface LoadedPageState {
  readonly loadingDirection: 'next' | 'previous' | null;
  readonly totalEntryCount: number;
  readonly unassignedTradeCount: number;
  readonly window: JournalPageWindow;
}

const EMPTY_PAGE_STATE: LoadedPageState = {
  loadingDirection: null,
  totalEntryCount: 0,
  unassignedTradeCount: 0,
  window: { pages: [], rowStartIndex: 0 },
};

export const useTradesTablePresenter = ({
  accounts,
  dataVersion,
  instruments,
  layout,
  loadPage,
  onLayoutChange,
  tags,
  tradePreferences,
}: UseTradesTablePresenterOptions): TradesTablePresenter => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<TradeTableFilterState>(createInitialTradeTableFilterState);
  const [showCashMovements, setShowCashMovements] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageState, setPageState] = useState<LoadedPageState>(EMPTY_PAGE_STATE);
  const requestGeneration = useRef(0);
  // Synchronous single-flight guard: both virtualization effects can run in the
  // same commit before the state-based `loadingDirection` is visible.
  const pendingLoad = useRef<'next' | 'previous' | null>(null);

  useEffect(() => {
    const generation = requestGeneration.current + 1;
    requestGeneration.current = generation;
    void loadPage(buildJournalPageRequest(filters, sorting, showCashMovements, null)).then(
      (page) => {
        if (requestGeneration.current !== generation || page === null) return;
        setPageState({
          loadingDirection: null,
          totalEntryCount: page.totalEntryCount,
          unassignedTradeCount: page.unassignedTradeCount,
          window: createJournalPageWindow(page),
        });
      },
    );
  }, [dataVersion, filters, loadPage, showCashMovements, sorting]);

  const loadMore = useCallback((): void => {
    const lastPage = pageState.window.pages[pageState.window.pages.length - 1];
    if (lastPage === undefined || lastPage.nextCursor === null || pendingLoad.current !== null) {
      return;
    }
    const generation = requestGeneration.current;
    const cursor = lastPage.nextCursor;
    pendingLoad.current = 'next';
    setPageState((current) => ({ ...current, loadingDirection: 'next' }));
    void loadPage(buildJournalPageRequest(filters, sorting, showCashMovements, cursor)).then(
      (page) => {
        pendingLoad.current = null;
        if (requestGeneration.current !== generation || page === null) {
          setPageState((current) => ({ ...current, loadingDirection: null }));
          return;
        }
        setPageState((current) => {
          return {
            loadingDirection: null,
            totalEntryCount: page.totalEntryCount,
            unassignedTradeCount: page.unassignedTradeCount,
            window:
              page.rows.length === 0
                ? closeJournalPageWindowBoundary(current.window, 'next')
                : appendJournalPage(current.window, page),
          };
        });
      },
    );
  }, [filters, loadPage, pageState.window, showCashMovements, sorting]);

  const loadPrevious = useCallback((): void => {
    const firstPage = pageState.window.pages[0];
    if (
      firstPage === undefined ||
      firstPage.previousCursor === null ||
      pendingLoad.current !== null
    ) {
      return;
    }
    const generation = requestGeneration.current;
    const cursor = firstPage.previousCursor;
    pendingLoad.current = 'previous';
    setPageState((current) => ({ ...current, loadingDirection: 'previous' }));
    void loadPage(buildJournalPageRequest(filters, sorting, showCashMovements, cursor)).then(
      (page) => {
        pendingLoad.current = null;
        if (requestGeneration.current !== generation || page === null) {
          setPageState((current) => ({ ...current, loadingDirection: null }));
          return;
        }
        setPageState((current) => ({
          loadingDirection: null,
          totalEntryCount: page.totalEntryCount,
          unassignedTradeCount: page.unassignedTradeCount,
          window:
            page.rows.length === 0
              ? closeJournalPageWindowBoundary(current.window, 'previous')
              : prependJournalPage(current.window, page),
        }));
      },
    );
  }, [filters, loadPage, pageState.window, showCashMovements, sorting]);

  const entries = useMemo(() => getJournalPageWindowRows(pageState.window), [pageState.window]);
  const firstPage = pageState.window.pages[0];
  const lastPage = pageState.window.pages[pageState.window.pages.length - 1];
  const hasMore = lastPage?.nextCursor !== null && lastPage !== undefined;
  const hasPrevious = firstPage?.previousCursor !== null && firstPage !== undefined;

  const accountOptions = useMemo(
    () => accounts.map((account) => ({ id: account.id, label: account.name })),
    [accounts],
  );

  const recentInstrumentIds = useMemo(() => {
    const ids = new Set<string>();
    entries.forEach((row) => {
      if (row.kind === 'trade') ids.add(row.trade.instrumentId);
    });
    return [...ids];
  }, [entries]);

  const assetOptions = useMemo(
    () =>
      orderInstrumentSelection(instruments, recentInstrumentIds).map((instrument) => ({
        id: instrument.id,
        label: instrument.symbol,
      })),
    [instruments, recentInstrumentIds],
  );

  const categoryLabels = useMemo(
    () =>
      Object.fromEntries(
        INSTRUMENT_CATEGORIES.map((category) => [
          category,
          t(INSTRUMENT_CATEGORY_LABEL_KEYS[category]),
        ]),
      ) as Readonly<Record<InstrumentCategory, string>>,
    [t],
  );

  const assetCategoryOptions = useMemo(
    () =>
      INSTRUMENT_CATEGORIES.map((category) => ({
        id: category,
        label: categoryLabels[category],
      })),
    [categoryLabels],
  );

  const assetCategories = useMemo(
    () => new Map(instruments.map((instrument) => [instrument.id, instrument.category])),
    [instruments],
  );

  const tagsById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);

  const tagOptions = useMemo(
    () =>
      [...tags]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((tag) => ({ id: tag.id, label: tag.name })),
    [tags],
  );

  const entryFilterOptions = useMemo(
    () => [
      { label: t(TRANSLATION_KEYS.tradeDirectionLong), value: TRADE_ENTRY_FILTERS.long },
      { label: t(TRANSLATION_KEYS.tradeDirectionShort), value: TRADE_ENTRY_FILTERS.short },
      { label: t(TRANSLATION_KEYS.accountDeposit), value: TRADE_ENTRY_FILTERS.deposit },
      { label: t(TRANSLATION_KEYS.accountWithdrawal), value: TRADE_ENTRY_FILTERS.withdrawal },
    ],
    [t],
  );

  const resultUnitOptions = useMemo(
    () => [
      { label: t(TRANSLATION_KEYS.tableResultAll), value: 'all' as const },
      { label: t(TRANSLATION_KEYS.tradeUnitCash), value: 'cash' as const },
      { label: t(TRANSLATION_KEYS.tradeUnitPercent), value: 'percent' as const },
      { label: t(TRANSLATION_KEYS.tradeUnitR), value: 'r' as const },
    ],
    [t],
  );

  const filteredTradeIds = useMemo(
    () => entries.filter((row) => row.kind === 'trade').map((row) => row.trade.id),
    [entries],
  );

  const columns = useMemo(
    () =>
      createTradeTableColumns({
        assetCategories,
        categoryLabels,
        labels: createTradeTableColumnLabels(t),
        tagOverflowLabel: (hiddenCount) => t(TRANSLATION_KEYS.tagShowMore, { count: hiddenCount }),
        tags: tagsById,
        tradePreferences,
      }),
    [assetCategories, categoryLabels, t, tagsById, tradePreferences],
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
    onSortingChange: setSorting,
    sizeLimits: TRADE_TABLE_COLUMN_SIZE_LIMITS,
    sorting,
  });

  const resetFilters = useCallback((): void => {
    setFilters(createInitialTradeTableFilterState());
  }, []);

  const updateFilters = useCallback(
    (
      patch:
        | Partial<TradeTableFilterState>
        | ((current: TradeTableFilterState) => Partial<TradeTableFilterState>),
    ): void => {
      setFilters((current) => ({
        ...current,
        ...(typeof patch === 'function' ? patch(current) : patch),
      }));
    },
    [],
  );

  return {
    accountOptions,
    activeFilterColumnId: controller.activeFilterColumnId,
    applyLayout: controller.applyLayout,
    assetCategoryOptions,
    assetOptions,
    clearSelection: controller.clearSelection,
    columns: controller.columnControls,
    entries,
    filteredTradeIds,
    filters: {
      ...filters,
      active: hasActiveTradeTableFilters(filters),
      entryFilterOptions,
      reset: resetFilters,
      resultUnitOptions,
      setAccountFilterIds: (ids) => updateFilters({ accountFilterIds: ids }),
      setAccountIncludeUnassigned: (value) => updateFilters({ accountIncludeUnassigned: value }),
      setAssetCategoryFilters: (values) => updateFilters({ assetCategoryFilters: values }),
      setAssetFilterIds: (ids) => updateFilters({ assetFilterIds: ids }),
      setDateFrom: (value) => updateFilters({ dateFrom: value }),
      setDateTo: (value) => updateFilters({ dateTo: value }),
      setDateTimeRange: (dateTimeRange) => updateFilters({ dateTimeRange }),
      setDetailBounds: (field, bounds) =>
        updateFilters((current) => {
          const detailBounds = { ...current.detailBounds };
          if (bounds === undefined) delete detailBounds[field];
          else detailBounds[field] = bounds;
          return { detailBounds };
        }),
      setEntryFilters: (values) => updateFilters({ entryFilters: values }),
      setNotePresence: (notePresence) => updateFilters({ notePresence }),
      setResultBounds: (resultBounds) => updateFilters({ resultBounds }),
      setResultUnit: (resultUnit) => updateFilters({ resultUnit }),
      setReviewStatuses: (reviewStatuses) => updateFilters({ reviewStatuses }),
      setTagFilterIds: (tagFilterIds) => updateFilters({ tagFilterIds }),
      setTagIncludeUntagged: (tagIncludeUntagged) => updateFilters({ tagIncludeUntagged }),
      setTextQuery: (textQuery) => updateFilters({ textQuery }),
    },
    hasEntries: pageState.totalEntryCount > 0,
    hasMore,
    hasPrevious,
    loading: pageState.loadingDirection !== null,
    loadMore,
    loadPrevious,
    mode: controller.mode,
    recentInstrumentIds,
    selectedCashMovement:
      controller.selectedRows.length === 1 && controller.selectedRows[0]?.kind !== 'trade'
        ? (controller.selectedRows[0]?.movement ?? null)
        : null,
    selectedCashMovementIds: controller.selectedRows
      .filter((row) => row.kind !== 'trade')
      .map((row) => row.movement.id),
    selectedCount: controller.selectedRows.length,
    selectedTrade:
      controller.selectedRows.length === 1 && controller.selectedRows[0]?.kind === 'trade'
        ? (controller.selectedRows[0]?.trade ?? null)
        : null,
    selectedTradeIds: controller.selectedRows
      .filter((row) => row.kind === 'trade')
      .map((row) => row.trade.id),
    setActiveFilter: controller.setActiveFilter,
    setMode: controller.setMode,
    setShowCashMovements,
    showCashMovements,
    table: controller.table,
    tagOptions,
    toggleColumn: controller.toggleColumn,
    unassignedTradeCount: pageState.unassignedTradeCount,
    virtualRowCount:
      pageState.window.rowStartIndex + entries.length + (hasMore ? JOURNAL_PAGE_LIMIT : 0),
    virtualRowStartIndex: pageState.window.rowStartIndex,
  };
};
