import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ApplicationSettingsDto,
  AnalyticsReportDto,
  AnalyticsReportRequestDto,
  AccountDto,
  AccountInstrumentDefaultsDto,
  CreateAccountDto,
  CashMovementDto,
  CreateCashMovementDto,
  UpdateAccountDto,
  UpdateInstrumentDto,
  HistoryStateDto,
  InstrumentDto,
  JournalPageDto,
  JournalPageRequestDto,
  SafeErrorDto,
  TableLayoutDto,
  TradeDto,
  TradePreferencesDto,
  InstrumentCalculationProfileDto,
  TradeSummaryDto,
  TradeSummaryRequestDto,
  CreateTradeDto,
  CreateInstrumentDto,
  CreateTagDto,
  UpdateTagDto,
  TagDto,
  UpdateCashMovementDto,
  IpcResult,
  VaultDto,
  VaultBackupDto,
  VaultBackupPageDto,
} from '../../../shared/desktop-api';
import type { RendererGateway } from '../../gateway/renderer-gateway';
import { DEFAULT_APPLICATION_SETTINGS } from '../../../shared/application-settings';
import { i18n } from '../../i18n';
import {
  ALL_REFRESH_GROUPS,
  REFRESH_GROUPS,
  resolveRefreshGroups,
  type RefreshTarget,
} from './refresh-resources';
import { RefreshScheduler } from './refresh-scheduler';

export type ApplicationPage = 'catalog' | 'settings' | 'statistics' | 'trades';

export interface JournalPresenter {
  readonly dataVersion: number;
  readonly vaultPath: string | null;
  /** Increments on every successful vault activation, including the same path reopened. */
  readonly vaultSessionId: number;
  readonly vaultResolved: boolean;
  readonly vaultError: SafeErrorDto | null;
  readonly accountsLoaded: boolean;
  readonly error: SafeErrorDto | null;
  readonly history: HistoryStateDto;
  readonly instruments: readonly InstrumentDto[];
  readonly accounts: readonly AccountDto[];
  readonly cashMovements: readonly CashMovementDto[];
  readonly page: ApplicationPage;
  readonly settings: ApplicationSettingsDto;
  readonly tags: readonly TagDto[];
  readonly tagTradeCounts: Readonly<Record<string, number>>;
  readonly tradePreferences: TradePreferencesDto;
  createTag(input: CreateTagDto): Promise<TagDto | null>;
  updateTag(input: UpdateTagDto): Promise<TagDto | null>;
  /** `true` only when the acknowledged IPC result is successful. */
  deleteTags(ids: readonly string[]): Promise<boolean>;
  createInstrument(input: CreateInstrumentDto): Promise<InstrumentDto | null>;
  createVault(): Promise<SafeErrorDto | null>;
  createVaultBackup(): Promise<IpcResult<VaultBackupDto>>;
  listVaultBackups(beforeId?: string | null): Promise<IpcResult<VaultBackupPageDto>>;
  verifyVaultBackup(id: string): Promise<IpcResult<VaultBackupDto>>;
  restoreVaultBackup(id: string): Promise<IpcResult<VaultDto | null>>;
  openVault(): Promise<SafeErrorDto | null>;
  revealVaultFolder(): Promise<SafeErrorDto | null>;
  validateVault(): Promise<SafeErrorDto | null>;
  createAccount(input: CreateAccountDto): Promise<AccountDto | null>;
  updateAccount(input: UpdateAccountDto): Promise<AccountDto | null>;
  deleteAccount(id: string): Promise<AccountDto | null>;
  restoreAccount(id: string): Promise<AccountDto | null>;
  /** `null` means the read failed; an empty array is a real, intentionally empty profile list. */
  listAccountDefaults(accountId: string): Promise<readonly AccountInstrumentDefaultsDto[] | null>;
  updateInstrument(input: UpdateInstrumentDto): Promise<InstrumentDto | null>;
  deleteInstrument(id: string): Promise<InstrumentDto | null>;
  restoreInstrument(id: string): Promise<InstrumentDto | null>;
  /** `true` only when the trade was acknowledged; a safe error keeps the draft alive. */
  createTrade(input: Omit<CreateTradeDto, 'closedAt'>): Promise<boolean>;
  createCashMovement(input: CreateCashMovementDto): Promise<CashMovementDto | null>;
  updateCashMovement(input: UpdateCashMovementDto): Promise<CashMovementDto | null>;
  deleteCashMovement(id: string): Promise<CashMovementDto | null>;
  getInstrumentProfile(instrumentId: string): Promise<InstrumentCalculationProfileDto | null>;
  getTrade(id: string): Promise<TradeDto | null>;
  getJournalPage(input: JournalPageRequestDto): Promise<JournalPageDto | null>;
  getTradeSummary(input: TradeSummaryRequestDto): Promise<TradeSummaryDto | null>;
  getAnalyticsReport(input: AnalyticsReportRequestDto): Promise<AnalyticsReportDto | null>;
  deleteTrade(id: string): Promise<void>;
  deleteTrades(ids: readonly string[]): Promise<void>;
  redo(): Promise<void>;
  setPage(page: ApplicationPage): void;
  updateSettings(settings: ApplicationSettingsDto): Promise<void>;
  updateInstrumentProfile(profile: InstrumentCalculationProfileDto): Promise<void>;
  updateTradePreferences(
    preferences: TradePreferencesDto,
    rebindHistorical?: boolean,
  ): Promise<void>;
  updateTableLayout(layout: TableLayoutDto): Promise<void>;
  updateTrade(trade: TradeDto): Promise<boolean>;
  undo(): Promise<void>;
}

const EMPTY_HISTORY: HistoryStateDto = {
  canRedo: false,
  canUndo: false,
  redoLabel: null,
  undoLabel: null,
};
const EMPTY_TRADE_PREFERENCES: TradePreferencesDto = {
  neutralCostSettings: { includeCommission: false, includeSpread: false },
  neutralRanges: { cash: null, percent: null, r: null },
  riskBinding: null,
  riskPromptDismissed: false,
};
const MUTATION_REFRESH_FALLBACK_MS = 250;

export const useJournalPresenter = (gateway: RendererGateway): JournalPresenter => {
  const [error, setError] = useState<SafeErrorDto | null>(null);
  const [history, setHistory] = useState<HistoryStateDto>(EMPTY_HISTORY);
  const [instruments, setInstruments] = useState<readonly InstrumentDto[]>([]);
  const [accounts, setAccounts] = useState<readonly AccountDto[]>([]);
  const [cashMovements, setCashMovements] = useState<readonly CashMovementDto[]>([]);
  const [page, setPage] = useState<ApplicationPage>('trades');
  const [settings, setSettings] = useState<ApplicationSettingsDto>(DEFAULT_APPLICATION_SETTINGS);
  const [tags, setTags] = useState<readonly TagDto[]>([]);
  const [tagTradeCounts, setTagTradeCounts] = useState<Readonly<Record<string, number>>>({});
  const [tradePreferences, setTradePreferences] =
    useState<TradePreferencesDto>(EMPTY_TRADE_PREFERENCES);
  const [dataVersion, setDataVersion] = useState(0);
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [vaultSessionId, setVaultSessionId] = useState(0);
  const [vaultResolved, setVaultResolved] = useState(false);
  const [vaultError, setVaultError] = useState<SafeErrorDto | null>(null);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const generationRef = useRef<string | null>(null);
  const eventCountRef = useRef(0);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAccounts = useCallback(async (): Promise<void> => {
    const [accountResult, movementResult] = await Promise.all([
      gateway.listAccounts(),
      gateway.listCashMovements(),
    ]);
    if (!accountResult.ok) {
      setError(accountResult.error);
      return;
    }
    if (!movementResult.ok) {
      setError(movementResult.error);
      return;
    }
    setAccounts(accountResult.value);
    setCashMovements(movementResult.value);
    setAccountsLoaded(true);
  }, [gateway]);

  const loadInstruments = useCallback(async (): Promise<void> => {
    const result = await gateway.listInstruments();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInstruments(result.value);
  }, [gateway]);

  const loadTags = useCallback(async (): Promise<void> => {
    const [tagResult, countResult] = await Promise.all([
      gateway.listTags(),
      gateway.getTagTradeCounts(),
    ]);
    if (!tagResult.ok) {
      setError(tagResult.error);
      return;
    }
    if (!countResult.ok) {
      setError(countResult.error);
      return;
    }
    setTags(tagResult.value);
    setTagTradeCounts(countResult.value);
  }, [gateway]);

  const loadHistory = useCallback(async (): Promise<void> => {
    const result = await gateway.getHistory();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setHistory(result.value);
  }, [gateway]);

  const loadSettings = useCallback(async (): Promise<void> => {
    const result = await gateway.getSettings();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSettings(result.value);
  }, [gateway]);

  const loadTradePreferences = useCallback(async (): Promise<void> => {
    const result = await gateway.getTradePreferences();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTradePreferences(result.value);
  }, [gateway]);

  const runGroups = useCallback(
    async (targets: readonly RefreshTarget[]): Promise<void> => {
      const groups = new Set<string>();
      targets.forEach((target) => {
        if (target === 'all') ALL_REFRESH_GROUPS.forEach((group) => groups.add(group));
        else groups.add(target);
      });
      await Promise.all([
        groups.has(REFRESH_GROUPS.accounts) ? loadAccounts() : Promise.resolve(),
        groups.has(REFRESH_GROUPS.instruments) ? loadInstruments() : Promise.resolve(),
        groups.has(REFRESH_GROUPS.tags) ? loadTags() : Promise.resolve(),
        groups.has(REFRESH_GROUPS.history) ? loadHistory() : Promise.resolve(),
        groups.has(REFRESH_GROUPS.settings) ? loadSettings() : Promise.resolve(),
        groups.has(REFRESH_GROUPS.tradePreferences) ? loadTradePreferences() : Promise.resolve(),
      ]);
    },
    [loadAccounts, loadHistory, loadInstruments, loadSettings, loadTags, loadTradePreferences],
  );

  const scheduler = useMemo(() => new RefreshScheduler(runGroups), [runGroups]);

  const clearFallbackRefresh = useCallback((): void => {
    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  // A mutation normally publishes a committed change event. The timer only
  // covers a lost event so a successful write can never leave the UI stale.
  const scheduleFallbackRefresh = useCallback((): void => {
    if (fallbackTimerRef.current !== null) return;
    fallbackTimerRef.current = setTimeout(() => {
      fallbackTimerRef.current = null;
      scheduler.schedule(['all']);
    }, MUTATION_REFRESH_FALLBACK_MS);
  }, [scheduler]);

  const applyVaultResult = useCallback(
    async (result: IpcResult<VaultDto | null>): Promise<SafeErrorDto | null> => {
      if (!result.ok) {
        setVaultError(result.error);
        return result.error;
      }
      // A cancelled native picker returns null and must not change the current state.
      if (result.value === null) return null;
      // Load the journal before revealing the workspace so the account dialog
      // does not flash for a vault that already has accounts.
      await scheduler.refreshAll();
      setVaultPath(result.value.path);
      // A new session must never inherit drafts or pending confirmations from the
      // previous vault, even when the same folder is opened again.
      setVaultSessionId((value) => value + 1);
      setVaultError(null);
      setError(null);
      return null;
    },
    [scheduler],
  );

  const createVault = useCallback(
    (): Promise<SafeErrorDto | null> => gateway.createVault().then(applyVaultResult),
    [applyVaultResult, gateway],
  );

  const openVault = useCallback(
    (): Promise<SafeErrorDto | null> => gateway.openVault().then(applyVaultResult),
    [applyVaultResult, gateway],
  );
  const listVaultBackups = useCallback(
    (beforeId?: string | null) => gateway.listVaultBackups(beforeId),
    [gateway],
  );

  const validateVault = useCallback(async (): Promise<SafeErrorDto | null> => {
    const result = await gateway.validateVault();
    return result.ok ? null : result.error;
  }, [gateway]);

  const revealVaultFolder = useCallback(async (): Promise<SafeErrorDto | null> => {
    const result = await gateway.revealVaultFolder();
    return result.ok ? null : result.error;
  }, [gateway]);

  useEffect(() => {
    void scheduler.refreshAll();
  }, [scheduler]);

  useEffect(() => () => scheduler.dispose(), [scheduler]);

  useEffect(
    () => () => {
      clearFallbackRefresh();
    },
    [clearFallbackRefresh],
  );

  useEffect(() => {
    void gateway
      .getDiagnostics()
      .then((result) => {
        if (result?.ok) setVaultPath(result.value.vaultPath);
      })
      .finally(() => setVaultResolved(true));
  }, [gateway]);

  useEffect(() => {
    return gateway.subscribeToChanges((change) => {
      eventCountRef.current += 1;
      clearFallbackRefresh();
      setDataVersion((version) => version + 1);
      const previousGeneration = generationRef.current;
      generationRef.current = change.vaultGeneration;
      if (previousGeneration !== null && previousGeneration !== change.vaultGeneration) {
        scheduler.schedule(['all']);
        return;
      }
      const groups = resolveRefreshGroups(change.resources);
      scheduler.schedule(groups);
    });
  }, [clearFallbackRefresh, gateway, scheduler]);

  useEffect(() => {
    const language =
      settings.languageMode === 'system' ? navigator.language.slice(0, 2) : settings.languageMode;
    void i18n.changeLanguage(language === 'en' ? 'en' : 'ru');
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    document.documentElement.dataset.theme =
      settings.themeMode === 'auto' ? (mediaQuery.matches ? 'dark' : 'light') : settings.themeMode;
  }, [settings]);

  // Void-shaped mutations cannot report success through `undefined !== null`, so
  // draft-owning callers read the acknowledged result explicitly.
  const executeWithStatus = useCallback(
    async <T>(
      action: () => Promise<IpcResult<T>>,
    ): Promise<{ readonly succeeded: boolean; readonly value: T | null }> => {
      const eventsBefore = eventCountRef.current;
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return { succeeded: false, value: null };
      }
      setError(null);
      if (eventCountRef.current === eventsBefore) scheduleFallbackRefresh();
      return { succeeded: true, value: result.value };
    },
    [scheduleFallbackRefresh],
  );

  const execute = useCallback(
    async <T>(action: () => Promise<IpcResult<T>>): Promise<T | null> =>
      (await executeWithStatus(action)).value,
    [executeWithStatus],
  );

  const query = useCallback(async <T>(action: () => Promise<IpcResult<T>>): Promise<T | null> => {
    const result = await action();
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    setError(null);
    return result.value;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || !['y', 'z'].includes(event.key.toLowerCase())) return;
      event.preventDefault();
      if (event.key.toLowerCase() === 'y' || event.shiftKey) void execute(() => gateway.redo());
      else void execute(() => gateway.undo());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [execute, gateway]);

  const getInstrumentProfile = useCallback(
    (instrumentId: string) => query(() => gateway.getInstrumentProfile(instrumentId)),
    [gateway, query],
  );
  const getJournalPage = useCallback(
    (input: JournalPageRequestDto) => query(() => gateway.getJournalPage(input)),
    [gateway, query],
  );
  const getTrade = useCallback((id: string) => query(() => gateway.getTrade(id)), [gateway, query]);
  const getTradeSummary = useCallback(
    (input: TradeSummaryRequestDto) => query(() => gateway.getTradeSummary(input)),
    [gateway, query],
  );
  const getAnalyticsReport = useCallback(
    (input: AnalyticsReportRequestDto) => query(() => gateway.getAnalyticsReport(input)),
    [gateway, query],
  );

  return {
    createInstrument: (input) => execute(() => gateway.createInstrument(input)),
    createTag: (input) => execute(() => gateway.createTag(input)),
    updateTag: (input) => execute(() => gateway.updateTag(input)),
    deleteTags: async (ids) => (await executeWithStatus(() => gateway.deleteTags(ids))).succeeded,
    createVault,
    createVaultBackup: () => gateway.createVaultBackup(),
    listVaultBackups,
    verifyVaultBackup: (id) => gateway.verifyVaultBackup(id),
    restoreVaultBackup: (id) => gateway.restoreVaultBackup(id),
    openVault,
    revealVaultFolder,
    validateVault,
    createTrade: async (input) =>
      (
        await executeWithStatus(() =>
          gateway.createTrade({ ...input, closedAt: new Date().toISOString() }),
        )
      ).succeeded,
    createCashMovement: (input) => execute(() => gateway.createCashMovement(input)),
    updateCashMovement: (input) => execute(() => gateway.updateCashMovement(input)),
    deleteCashMovement: (id) => execute(() => gateway.deleteCashMovement(id)),
    createAccount: (input) => execute(() => gateway.createAccount(input)),
    updateAccount: (input) => execute(() => gateway.updateAccount(input)),
    deleteAccount: (id) => execute(() => gateway.deleteAccount(id)),
    restoreAccount: (id) => execute(() => gateway.restoreAccount(id)),
    updateInstrument: (input) => execute(() => gateway.updateInstrument(input)),
    deleteInstrument: (id) => execute(() => gateway.deleteInstrument(id)),
    restoreInstrument: (id) => execute(() => gateway.restoreInstrument(id)),
    listAccountDefaults: async (accountId) => {
      const result = await gateway.listAccountDefaults(accountId);
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      return result.value;
    },
    accounts,
    accountsLoaded,
    cashMovements,
    dataVersion,
    vaultPath,
    vaultSessionId,
    vaultResolved,
    vaultError,
    deleteTrade: async (id) => {
      await execute(() => gateway.deleteTrade(id));
    },
    deleteTrades: async (ids) => {
      await execute(() => gateway.deleteTrades(ids));
    },
    error,
    getInstrumentProfile,
    getTrade,
    getJournalPage,
    getTradeSummary,
    getAnalyticsReport,
    history,
    instruments,
    page,
    redo: async () => {
      await execute(() => gateway.redo());
    },
    setPage,
    settings,
    tags,
    tagTradeCounts,
    tradePreferences,
    undo: async () => {
      await execute(() => gateway.undo());
    },
    updateSettings: async (value) => {
      await execute(() => gateway.updateSettings(value));
    },
    updateInstrumentProfile: async (profile) => {
      await execute(() => gateway.updateInstrumentProfile(profile));
    },
    updateTradePreferences: async (preferences, rebindHistorical = false) => {
      await execute(() => gateway.updateTradePreferences({ preferences, rebindHistorical }));
    },
    updateTableLayout: async (layout) => {
      await execute(() =>
        gateway.updateSettings({
          ...settings,
          tableLayouts: [
            ...settings.tableLayouts.filter((existing) => existing.id !== layout.id),
            layout,
          ],
        }),
      );
    },
    updateTrade: async (trade) =>
      (await executeWithStatus(() => gateway.updateTrade(trade))).succeeded,
  };
};
