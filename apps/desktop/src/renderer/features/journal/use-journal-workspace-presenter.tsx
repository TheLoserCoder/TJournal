import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  TABLE_IDENTIFIERS,
  type AccountDto,
  type InstrumentCategory,
  type TradeDto,
} from '../../../shared/desktop-api';
import { convertTradeResult } from '@tjournal/trade/calculations';
import type { JournalPresenter } from './use-journal-presenter';
import { DEFAULT_INSTRUMENT_CATEGORY } from './entity-table.config';
import { useTradeEditorPresenter, type TradeEditorPresenter } from './use-trade-editor-presenter';
import {
  useTradeSettingsPresenter,
  type TradeSettingsPresenter,
} from './use-trade-settings-presenter';
import {
  useTradeSummaryPresenter,
  type TradeSummaryPresenter,
} from './use-trade-summary-presenter';
import {
  orderInstrumentSelection,
  useTradesTablePresenter,
  type TradesTablePresenter,
} from './use-trades-table-presenter';
import { toJournalPageFilters } from './journal-page-query';
import { createInitialTradeTableFilterState } from './trade-table-filters';
import { useCatalogPresenter, type CatalogPresenter } from './use-catalog-presenter';
import { resolveAccountSelection } from './account-selection';
import { planAccountRiskPersistence } from './account-risk-update';
import {
  useVaultSettingsPresenter,
  type VaultSettingsPresenter,
} from './use-vault-settings-presenter';
import { useStatisticsPresenter, type StatisticsPresenter } from '../statistics';

const ACCOUNT_SELECTION_STORAGE_PREFIX = 'tjournal.account-selection.';

/**
 * Quick-entry submission result. Only the draft-owning presenter interprets it:
 * `failed` keeps the typed result and tags, `asset-confirmation` opens the asset
 * dialog, `risk-required` asks for the missing 1R and `ignored` means there was
 * nothing to submit.
 */
export type QuickEntryOutcome =
  'asset-confirmation' | 'failed' | 'ignored' | 'risk-required' | 'saved';

export interface JournalWorkspacePresenter extends TradeEditorPresenter {
  readonly confirmSymbol: string | null;
  readonly confirmAssetCategory: InstrumentCategory;
  readonly deletingTradeIds: readonly string[];
  readonly deletingCashMovementIds: readonly string[];
  readonly direction: 'long' | 'short';
  readonly entryKind: 'trade' | 'deposit' | 'withdrawal';
  readonly legacyLookupEmpty: boolean;
  readonly legacyUnassignedCount: number;
  readonly movementAmount: string;
  readonly journal: JournalPresenter;
  readonly instrumentSelection: readonly JournalPresenter['instruments'][number][];
  readonly resultKind: TradeDto['resultKind'];
  readonly resultValue: string;
  readonly resultPreviewUsd: string | null;
  readonly percentBaseUsd: string | null;
  readonly riskUsd: string;
  readonly riskPromptOpen: boolean;
  readonly symbol: string;
  readonly accountId: string | null;
  readonly tableLayoutColumns: readonly {
    readonly id: string;
    readonly label: string;
    readonly visible: boolean;
  }[];
  readonly tableLayoutOpen: boolean;
  readonly tableLayoutShowCashMovements: boolean;
  readonly tableLayoutRiskUsd: string;
  readonly tradeSettings: TradeSettingsPresenter;
  readonly tradeSummary: TradeSummaryPresenter;
  readonly tradeTable: TradesTablePresenter;
  readonly catalog: CatalogPresenter;
  readonly statistics: StatisticsPresenter;
  readonly tagIds: readonly string[];
  readonly vaultSettings: VaultSettingsPresenter;
  applyTableLayout(): void;
  cancelRiskPrompt(): void;
  closeConfirmation(): void;
  confirmAssetAndCreateTrade(): Promise<boolean>;
  confirmDeleteEntries(): Promise<void>;
  createTrade(): Promise<QuickEntryOutcome>;
  openLegacyMigration(): void;
  setConfirmAssetCategory(value: InstrumentCategory): void;
  setDeletingTradeIds(ids: readonly string[]): void;
  setDeletingCashMovementIds(ids: readonly string[]): void;
  setDirection(value: 'long' | 'short'): void;
  setEntryKind(value: 'trade' | 'deposit' | 'withdrawal'): void;
  setMovementAmount(value: string): void;
  setResultKind(value: TradeDto['resultKind']): void;
  setResultValue(value: string): void;
  setRiskUsd(value: string): void;
  setSymbol(value: string): void;
  setAccountId(value: string | null): void;
  setTableLayoutOpen(open: boolean): void;
  setTableLayoutShowCashMovements(value: boolean): void;
  setTableLayoutRiskUsd(value: string): void;
  setTagIds(ids: readonly string[]): void;
  submitRiskPrompt(value: string): Promise<void>;
  toggleTableLayoutColumn(id: string): void;
}

export const useJournalWorkspacePresenter = (
  journal: JournalPresenter,
): JournalWorkspacePresenter => {
  const [symbol, setSymbol] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [entryKind, setEntryKind] = useState<'trade' | 'deposit' | 'withdrawal'>('trade');
  const [movementAmount, setMovementAmount] = useState('');
  const [resultKind, setResultKind] = useState<TradeDto['resultKind']>('cash');
  const [resultValue, setResultValue] = useState('');
  const [riskUsd, setRiskUsd] = useState('');
  const riskAccountRef = useRef<string | null>(null);
  const [confirmSymbol, setConfirmSymbol] = useState<string | null>(null);
  const [confirmAssetCategory, setConfirmAssetCategory] = useState<InstrumentCategory>(
    DEFAULT_INSTRUMENT_CATEGORY,
  );
  const [deletingTradeIds, setDeletingTradeIds] = useState<readonly string[]>([]);
  const [deletingCashMovementIds, setDeletingCashMovementIds] = useState<readonly string[]>([]);
  const [tableLayoutColumns, setTableLayoutColumns] = useState<
    JournalWorkspacePresenter['tableLayoutColumns']
  >([]);
  const [tableLayoutOpen, setTableLayoutOpen] = useState(false);
  const [tableLayoutShowCashMovements, setTableLayoutShowCashMovements] = useState(true);
  const [tableLayoutRiskUsd, setTableLayoutRiskUsd] = useState('');
  const [riskPromptOpen, setRiskPromptOpen] = useState(false);
  const [tagIds, setTagIds] = useState<readonly string[]>([]);
  // A created asset may outlive a failed trade save; the retry reuses its id
  // instead of creating a second asset for the same symbol.
  const [createdInstrumentId, setCreatedInstrumentId] = useState<string | null>(null);
  const [legacyLookupEmpty, setLegacyLookupEmpty] = useState(false);
  const disposed = useRef(false);
  const quickEntryPending = useRef(false);
  const applyingTableLayout = useRef(false);
  const confirmedAccountRisk = useRef<{
    readonly accountId: string;
    readonly riskUsd: string;
    readonly vaultPath: string | null;
  } | null>(null);
  const resolvedSelectionVaultRef = useRef<string | null>(null);
  const tradeTable = useTradesTablePresenter({
    accounts: journal.accounts,
    dataVersion: journal.dataVersion,
    instruments: journal.instruments,
    layout: journal.settings.tableLayouts.find((layout) => layout.id === TABLE_IDENTIFIERS.trades),
    loadPage: journal.getJournalPage,
    onLayoutChange: (layout) => void journal.updateTableLayout(layout),
    tags: journal.tags,
    tradePreferences: journal.tradePreferences,
  });
  const catalog = useCatalogPresenter(journal);
  const selectedAccount = journal.accounts.find((account) => account.id === accountId);
  const instrumentSelection = useMemo(
    () => orderInstrumentSelection(journal.instruments, tradeTable.recentInstrumentIds),
    [journal.instruments, tradeTable.recentInstrumentIds],
  );
  useEffect(() => {
    if (riskAccountRef.current === accountId) return;
    riskAccountRef.current = accountId;
    setRiskUsd(selectedAccount?.defaultRiskUsd ?? '');
  }, [accountId, selectedAccount]);
  const resultPreviewUsd = useMemo(() => {
    if (resultValue.trim() === '' || selectedAccount === undefined) return null;
    if (resultKind === 'percent' && selectedAccount.currentKnownBalanceUsd === '0') return null;
    try {
      return convertTradeResult(
        resultKind,
        resultValue,
        selectedAccount.currentKnownBalanceUsd,
        riskUsd.trim() === '' ? selectedAccount.defaultRiskUsd : riskUsd,
      ).netResultUsd;
    } catch {
      return null;
    }
  }, [resultKind, resultValue, riskUsd, selectedAccount]);
  const tradeSummary = useTradeSummaryPresenter(
    journal,
    {
      accountFilterIds: tradeTable.filters.accountFilterIds,
      assetFilterIds: tradeTable.filters.assetFilterIds,
      dateFrom: tradeTable.filters.dateFrom,
      dateTo: tradeTable.filters.dateTo,
      dateTimeRange: tradeTable.filters.dateTimeRange,
      entryFilters: tradeTable.filters.entryFilters,
      includeUnassigned: tradeTable.filters.accountIncludeUnassigned,
      resultBounds: tradeTable.filters.resultBounds,
      resultUnit: tradeTable.filters.resultUnit,
      textQuery: tradeTable.filters.textQuery,
    },
    journal.page === 'trades',
  );
  const statistics = useStatisticsPresenter({
    dataVersion: journal.dataVersion,
    enabled: journal.page === 'statistics',
    getReport: journal.getAnalyticsReport,
    settings: journal.settings,
    updateSettings: journal.updateSettings,
  });
  const tradeSettings = useTradeSettingsPresenter(journal);
  const vaultSettings = useVaultSettingsPresenter(journal);
  const tradeEditor = useTradeEditorPresenter(journal, {
    accountId,
    direction,
    resultKind,
    resultValue,
    symbol,
  });

  // The workspace is keyed by vault session, so unmount marks every pending
  // continuation as stale: it must not start another write in the new vault.
  useEffect(
    () => () => {
      disposed.current = true;
    },
    [],
  );

  useEffect(() => {
    if (journal.vaultPath === null) {
      resolvedSelectionVaultRef.current = null;
      return;
    }
    const vaultChanged = resolvedSelectionVaultRef.current !== journal.vaultPath;

    // An empty list can be an intermediate refresh state. Keep the current account
    // until the authoritative list arrives, except when entering another vault.
    if (journal.accounts.length === 0 && !vaultChanged) return;

    let remembered: string | null = null;
    try {
      remembered = window.localStorage.getItem(
        `${ACCOUNT_SELECTION_STORAGE_PREFIX}${journal.vaultPath}`,
      );
    } catch {
      remembered = null;
    }

    setAccountId((currentAccountId) =>
      resolveAccountSelection(journal.accounts, vaultChanged ? null : currentAccountId, remembered),
    );
    resolvedSelectionVaultRef.current = journal.vaultPath;
  }, [journal.accounts, journal.vaultPath]);

  const handleAccountChange = useCallback(
    (nextAccountId: string | null): void => {
      setAccountId(nextAccountId);
      if (journal.vaultPath === null) return;
      try {
        const storageKey = `${ACCOUNT_SELECTION_STORAGE_PREFIX}${journal.vaultPath}`;
        if (nextAccountId === null) window.localStorage.removeItem(storageKey);
        else window.localStorage.setItem(storageKey, nextAccountId);
      } catch {
        // A storage preference must not prevent trade entry.
      }
    },
    [journal.vaultPath],
  );

  useEffect(() => {
    if (
      resultKind === 'percent' &&
      (selectedAccount === undefined ||
        selectedAccount.currentKnownBalanceUsd === '0' ||
        selectedAccount.currentKnownBalanceUsd.startsWith('-'))
    )
      setResultKind('cash');
  }, [resultKind, selectedAccount]);

  const saveTrade = async (instrumentId: string, riskOverride?: string): Promise<boolean> => {
    if (accountId === null) return false;
    const risk = riskOverride ?? riskUsd;
    const saved = await journal.createTrade({
      direction,
      execution: null,
      instrumentId,
      accountId,
      ...(risk.trim() === '' ? {} : { riskUsd: risk }),
      resultKind,
      resultValue,
      tagIds,
    });
    if (!saved) return false;
    setResultValue('');
    setTagIds([]);
    return true;
  };

  const effectiveRiskUsd = (): string =>
    riskUsd.trim() === '' ? (selectedAccount?.defaultRiskUsd ?? '') : riskUsd.trim();

  const createTrade = async (riskOverride?: string): Promise<QuickEntryOutcome> => {
    // Duplicate submits would double a cash movement or a trade for one click.
    if (quickEntryPending.current) return 'ignored';
    quickEntryPending.current = true;
    try {
      if (entryKind !== 'trade') {
        if (accountId === null || movementAmount.trim() === '') return 'ignored';
        const created = await journal.createCashMovement({
          accountId,
          amountUsd: movementAmount,
          occurredAt: new Date().toISOString(),
          kind: entryKind,
        });
        if (created === null) return 'failed';
        setMovementAmount('');
        return 'saved';
      }
      if (accountId === null) return 'ignored';
      if (resultKind === 'r') {
        const effective = (riskOverride ?? effectiveRiskUsd()).trim();
        if (effective === '') {
          setRiskPromptOpen(true);
          return 'risk-required';
        }
      }
      const normalizedSymbol = symbol.trim().toUpperCase();
      if (normalizedSymbol === '') return 'ignored';
      const selected = journal.instruments.find(
        (instrument) => instrument.symbol === normalizedSymbol,
      );
      if (selected === undefined) {
        setConfirmAssetCategory(DEFAULT_INSTRUMENT_CATEGORY);
        setCreatedInstrumentId(null);
        setConfirmSymbol(normalizedSymbol);
        return 'asset-confirmation';
      }
      return (await saveTrade(selected.id, riskOverride)) ? 'saved' : 'failed';
    } finally {
      quickEntryPending.current = false;
    }
  };

  const submitRiskPrompt = async (value: string): Promise<void> => {
    const normalized = value.trim().replace(',', '.');
    if (normalized === '') return;
    const outcome = await createTrade(value);
    // Keep the prompt and its value when the trade was not acknowledged.
    if (outcome === 'failed' || outcome === 'ignored') return;
    setRiskUsd(value);
    setRiskPromptOpen(false);
  };

  // The table-settings 1R is remembered on the account, so it survives a
  // restart or an account switch instead of resetting to the last saved value.
  const persistAccountRisk = async (
    account: AccountDto,
    riskUsdValue: string,
  ): Promise<boolean> => {
    const defaults = await journal.listAccountDefaults(account.id);
    if (disposed.current) return false;
    const confirmed = confirmedAccountRisk.current;
    const effectiveAccount =
      confirmed !== null &&
      confirmed.accountId === account.id &&
      confirmed.vaultPath === journal.vaultPath
        ? { ...account, defaultRiskUsd: confirmed.riskUsd }
        : account;
    const plan = planAccountRiskPersistence(effectiveAccount, defaults, riskUsdValue);
    // A failed profile read must not become a write: updateAccount replaces the
    // stored profile list with whatever the caller sends.
    if (plan.kind === 'unavailable') return false;
    if (plan.kind === 'skip') return true;
    const saved = await journal.updateAccount(plan.update);
    if (saved === null) return false;
    confirmedAccountRisk.current = {
      accountId: account.id,
      riskUsd: saved.defaultRiskUsd ?? riskUsdValue.trim(),
      vaultPath: journal.vaultPath,
    };
    return true;
  };

  // The account save and the view-layout save are separate commands; the layout
  // is applied only after the risk write succeeded, so the dialog keeps its draft
  // when the risk cannot be stored.
  const applyTableLayout = (): void => {
    if (applyingTableLayout.current) return;
    applyingTableLayout.current = true;
    void (async (): Promise<void> => {
      try {
        const account = selectedAccount;
        if (account !== undefined) {
          const riskSaved = await persistAccountRisk(account, tableLayoutRiskUsd);
          if (!riskSaved) return;
        }
        tradeTable.setShowCashMovements(tableLayoutShowCashMovements);
        setRiskUsd(tableLayoutRiskUsd);
        tradeTable.applyLayout(tradeTable.mode, tableLayoutColumns);
        setTableLayoutOpen(false);
      } finally {
        applyingTableLayout.current = false;
      }
    })();
  };

  return {
    ...tradeEditor,
    applyTableLayout,
    cancelRiskPrompt: () => {
      setRiskPromptOpen(false);
    },
    closeConfirmation: () => {
      setConfirmSymbol(null);
      setCreatedInstrumentId(null);
    },
    confirmAssetAndCreateTrade: async () => {
      if (confirmSymbol === null) return false;
      let instrumentId = createdInstrumentId;
      if (instrumentId === null) {
        const instrument = await journal.createInstrument({
          category: confirmAssetCategory,
          symbol: confirmSymbol,
        });
        if (instrument === null || disposed.current) return false;
        instrumentId = instrument.id;
        setCreatedInstrumentId(instrument.id);
      }
      // On a failed trade save the dialog stays open; the retry reuses the
      // already created asset instead of creating a second one.
      if (!(await saveTrade(instrumentId))) return false;
      setConfirmSymbol(null);
      setCreatedInstrumentId(null);
      return true;
    },
    confirmDeleteEntries: async () => {
      if (deletingTradeIds.length > 0) await journal.deleteTrades(deletingTradeIds);
      for (const id of deletingCashMovementIds) await journal.deleteCashMovement(id);
      setDeletingTradeIds([]);
      setDeletingCashMovementIds([]);
    },
    confirmSymbol,
    confirmAssetCategory,
    createTrade,
    deletingTradeIds,
    deletingCashMovementIds,
    direction,
    entryKind,
    legacyLookupEmpty,
    legacyUnassignedCount: tradeTable.unassignedTradeCount,
    journal,
    instrumentSelection,
    openLegacyMigration: () => {
      setLegacyLookupEmpty(false);
      void journal
        .getJournalPage({
          cursor: null,
          filters: {
            ...toJournalPageFilters(createInitialTradeTableFilterState()),
            includeUnassigned: true,
          },
          includeCashMovements: false,
          limit: 1,
          sort: { direction: 'asc', field: 'date' },
        })
        .then((page) => {
          // A failed read already surfaced through the global safe error.
          if (page === null) return;
          const row = page.rows.find((entry) => entry.kind === 'trade');
          if (row !== undefined && row.kind === 'trade') {
            void tradeEditor.openSavedTrade(row.trade.id);
            return;
          }
          // The stale warning count found nothing: tell the user instead of
          // leaving the button looking broken.
          setLegacyLookupEmpty(true);
        });
    },
    resultKind,
    resultPreviewUsd,
    resultValue,
    percentBaseUsd:
      resultKind === 'percent' && selectedAccount !== undefined
        ? selectedAccount.currentKnownBalanceUsd
        : null,
    riskUsd,
    riskPromptOpen,
    setConfirmAssetCategory,
    setDeletingTradeIds,
    setDeletingCashMovementIds,
    setDirection,
    setEntryKind,
    setMovementAmount,
    setResultKind,
    setResultValue,
    setRiskUsd,
    setSymbol,
    setTableLayoutOpen: (open) => {
      if (open) {
        setTableLayoutColumns(tradeTable.columns);
        setTableLayoutShowCashMovements(tradeTable.showCashMovements);
        setTableLayoutRiskUsd(riskUsd);
      }
      setTableLayoutOpen(open);
    },
    symbol,
    movementAmount,
    accountId,
    setAccountId: handleAccountChange,
    submitRiskPrompt,
    tableLayoutColumns,
    tableLayoutOpen,
    tableLayoutShowCashMovements,
    tableLayoutRiskUsd,
    tagIds,
    tradeSettings,
    tradeSummary,
    tradeTable,
    catalog,
    statistics,
    vaultSettings,
    setTagIds,
    toggleTableLayoutColumn: (id) =>
      setTableLayoutColumns((current) =>
        current.map((column) =>
          column.id === id ? { ...column, visible: !column.visible } : column,
        ),
      ),
    setTableLayoutShowCashMovements,
    setTableLayoutRiskUsd,
  };
};
