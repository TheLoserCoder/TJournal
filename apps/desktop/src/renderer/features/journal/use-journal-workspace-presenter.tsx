import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TABLE_IDENTIFIERS, type TradeDto } from '../../../shared/desktop-api';
import { convertTradeResult } from '@tjournal/trade/calculations';
import type { JournalPresenter } from './use-journal-presenter';
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
import {
  useAccountsAssetsPresenter,
  type AccountsAssetsPresenter,
} from './use-accounts-assets-presenter';
import { resolveAccountSelection } from './account-selection';

const ACCOUNT_SELECTION_STORAGE_PREFIX = 'tjournal.account-selection.';

export interface JournalWorkspacePresenter extends TradeEditorPresenter {
  readonly confirmSymbol: string | null;
  readonly deletingTradeIds: readonly string[];
  readonly deletingCashMovementIds: readonly string[];
  readonly direction: 'long' | 'short';
  readonly entryKind: 'trade' | 'deposit' | 'withdrawal';
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
  readonly tradeSettings: TradeSettingsPresenter;
  readonly tradeSummary: TradeSummaryPresenter;
  readonly tradeTable: TradesTablePresenter;
  readonly accountsAssets: AccountsAssetsPresenter;
  applyTableLayout(): void;
  cancelRiskPrompt(): void;
  closeConfirmation(): void;
  confirmAssetAndCreateTrade(): Promise<void>;
  confirmDeleteEntries(): Promise<void>;
  createTrade(): Promise<void>;
  dismissRiskPrompt(): Promise<void>;
  openLegacyMigration(): void;
  openRiskSettings(): void;
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
  const [deletingTradeIds, setDeletingTradeIds] = useState<readonly string[]>([]);
  const [deletingCashMovementIds, setDeletingCashMovementIds] = useState<readonly string[]>([]);
  const [tableLayoutColumns, setTableLayoutColumns] = useState<
    JournalWorkspacePresenter['tableLayoutColumns']
  >([]);
  const [tableLayoutOpen, setTableLayoutOpen] = useState(false);
  const [tableLayoutShowCashMovements, setTableLayoutShowCashMovements] = useState(true);
  const [pendingTradeInstrumentId, setPendingTradeInstrumentId] = useState<string | null>(null);
  const [riskPromptOpen, setRiskPromptOpen] = useState(false);
  const resolvedSelectionVaultRef = useRef<string | null>(null);
  const tradeTable = useTradesTablePresenter({
    accounts: journal.accounts,
    cashMovements: journal.cashMovements,
    instruments: journal.instruments,
    layout: journal.settings.tableLayouts.find((layout) => layout.id === TABLE_IDENTIFIERS.trades),
    onLayoutChange: (layout) => void journal.updateTableLayout(layout),
    tradePreferences: journal.tradePreferences,
    trades: journal.trades,
  });
  const accountsAssets = useAccountsAssetsPresenter(journal);
  const selectedAccount = journal.accounts.find((account) => account.id === accountId);
  const instrumentSelection = useMemo(
    () => orderInstrumentSelection(journal.instruments, journal.trades),
    [journal.instruments, journal.trades],
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
  const tradeSummary = useTradeSummaryPresenter(journal, {
    accountFilterIds: tradeTable.accountFilterIds,
    assetFilterIds: tradeTable.assetFilterIds,
    dateFrom: tradeTable.dateFrom,
    dateTo: tradeTable.dateTo,
    includeUnassigned: tradeTable.includeUnassigned,
    resultFilter: tradeTable.resultFilter,
  });
  const tradeSettings = useTradeSettingsPresenter(journal);
  const tradeEditor = useTradeEditorPresenter(journal, {
    accountId,
    direction,
    resultKind,
    resultValue,
    symbol,
  });

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

  const saveTrade = async (instrumentId: string): Promise<void> => {
    if (accountId === null) return;
    await journal.createTrade({
      direction,
      execution: null,
      instrumentId,
      accountId,
      ...(riskUsd.trim() === '' ? {} : { riskUsd }),
      resultKind,
      resultValue,
    });
    setResultValue('');
  };

  const createTrade = async (): Promise<void> => {
    if (entryKind !== 'trade') {
      if (accountId === null || movementAmount.trim() === '') return;
      const created = await journal.createCashMovement({
        accountId,
        amountUsd: movementAmount,
        occurredAt: new Date().toISOString(),
        kind: entryKind,
      });
      if (created !== null) setMovementAmount('');
      return;
    }
    if (accountId === null) return;
    const normalizedSymbol = symbol.trim().toUpperCase();
    const selected = journal.instruments.find(
      (instrument) => instrument.symbol === normalizedSymbol,
    );
    if (selected === undefined) {
      setConfirmSymbol(normalizedSymbol);
      return;
    }
    await saveTrade(selected.id);
  };

  return {
    ...tradeEditor,
    applyTableLayout: () => {
      tradeTable.setShowCashMovements(tableLayoutShowCashMovements);
      tradeTable.applyLayout(tradeTable.mode, tableLayoutColumns);
      setTableLayoutOpen(false);
    },
    cancelRiskPrompt: () => {
      setRiskPromptOpen(false);
      setPendingTradeInstrumentId(null);
    },
    closeConfirmation: () => setConfirmSymbol(null),
    confirmAssetAndCreateTrade: async () => {
      if (confirmSymbol === null) return;
      const instrument = await journal.createInstrument({
        category: 'forex',
        symbol: confirmSymbol,
      });
      setConfirmSymbol(null);
      if (instrument !== null) await saveTrade(instrument.id);
    },
    confirmDeleteEntries: async () => {
      if (deletingTradeIds.length > 0) await journal.deleteTrades(deletingTradeIds);
      for (const id of deletingCashMovementIds) await journal.deleteCashMovement(id);
      setDeletingTradeIds([]);
      setDeletingCashMovementIds([]);
    },
    confirmSymbol,
    createTrade,
    deletingTradeIds,
    deletingCashMovementIds,
    direction,
    entryKind,
    legacyUnassignedCount: journal.trades.filter(
      (trade) => trade.account === null || trade.account === undefined,
    ).length,
    dismissRiskPrompt: async () => {
      if (accountId === null) {
        setRiskPromptOpen(false);
        setPendingTradeInstrumentId(null);
        return;
      }
      await journal.updateTradePreferences({
        ...journal.tradePreferences,
        riskPromptDismissed: true,
      });
      const instrumentId = pendingTradeInstrumentId;
      setPendingTradeInstrumentId(null);
      setRiskPromptOpen(false);
      if (instrumentId !== null)
        await journal.createTrade({
          direction,
          execution: null,
          instrumentId,
          accountId,
          ...(riskUsd.trim() === '' ? {} : { riskUsd }),
          resultKind,
          resultValue,
        });
      setResultValue('');
    },
    journal,
    instrumentSelection,
    openLegacyMigration: () => {
      const legacyTrade = journal.trades.find(
        (trade) => trade.account === null || trade.account === undefined,
      );
      if (legacyTrade !== undefined) tradeEditor.setEditingTrade(legacyTrade);
    },
    openRiskSettings: () => {
      setRiskPromptOpen(false);
      setPendingTradeInstrumentId(null);
      journal.setPage('settings');
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
      }
      setTableLayoutOpen(open);
    },
    symbol,
    movementAmount,
    accountId,
    setAccountId: handleAccountChange,
    tableLayoutColumns,
    tableLayoutOpen,
    tableLayoutShowCashMovements,
    tradeSettings,
    tradeSummary,
    tradeTable,
    accountsAssets,
    toggleTableLayoutColumn: (id) =>
      setTableLayoutColumns((current) =>
        current.map((column) =>
          column.id === id ? { ...column, visible: !column.visible } : column,
        ),
      ),
    setTableLayoutShowCashMovements,
  };
};
