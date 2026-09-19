import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  ApplicationSettingsDto,
  AccountDto,
  AccountInstrumentDefaultsDto,
  CreateAccountDto,
  CashMovementDto,
  CreateCashMovementDto,
  UpdateAccountDto,
  UpdateInstrumentDto,
  HistoryStateDto,
  InstrumentDto,
  SafeErrorDto,
  TableLayoutDto,
  TradeDto,
  TradePreferencesDto,
  InstrumentCalculationProfileDto,
  TradeSummaryDto,
  TradeSummaryRequestDto,
  CreateTradeDto,
  CreateInstrumentDto,
  UpdateCashMovementDto,
} from '../../../shared/desktop-api';
import type { RendererGateway } from '../../gateway/renderer-gateway';
import { DEFAULT_APPLICATION_SETTINGS } from '../../../shared/application-settings';
import { i18n } from '../../i18n';

export type ApplicationPage =
  'accounts-assets' | 'dashboard' | 'settings' | 'statistics' | 'trades';

export interface JournalPresenter {
  readonly dataVersion: number;
  readonly vaultPath: string | null;
  readonly error: SafeErrorDto | null;
  readonly history: HistoryStateDto;
  readonly instruments: readonly InstrumentDto[];
  readonly accounts: readonly AccountDto[];
  readonly cashMovements: readonly CashMovementDto[];
  readonly page: ApplicationPage;
  readonly settings: ApplicationSettingsDto;
  readonly trades: readonly TradeDto[];
  readonly tradePreferences: TradePreferencesDto;
  createInstrument(input: CreateInstrumentDto): Promise<InstrumentDto | null>;
  createAccount(input: CreateAccountDto): Promise<AccountDto | null>;
  updateAccount(input: UpdateAccountDto): Promise<AccountDto | null>;
  deleteAccount(id: string): Promise<AccountDto | null>;
  restoreAccount(id: string): Promise<AccountDto | null>;
  listAccountDefaults(accountId: string): Promise<readonly AccountInstrumentDefaultsDto[]>;
  updateInstrument(input: UpdateInstrumentDto): Promise<InstrumentDto | null>;
  deleteInstrument(id: string): Promise<InstrumentDto | null>;
  restoreInstrument(id: string): Promise<InstrumentDto | null>;
  createTrade(input: Omit<CreateTradeDto, 'closedAt'>): Promise<void>;
  createCashMovement(input: CreateCashMovementDto): Promise<CashMovementDto | null>;
  updateCashMovement(input: UpdateCashMovementDto): Promise<CashMovementDto | null>;
  deleteCashMovement(id: string): Promise<CashMovementDto | null>;
  getInstrumentProfile(instrumentId: string): Promise<InstrumentCalculationProfileDto | null>;
  getTradeSummary(input: TradeSummaryRequestDto): Promise<TradeSummaryDto | null>;
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
  updateTrade(trade: TradeDto): Promise<void>;
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
export const useJournalPresenter = (gateway: RendererGateway): JournalPresenter => {
  const [error, setError] = useState<SafeErrorDto | null>(null);
  const [history, setHistory] = useState<HistoryStateDto>(EMPTY_HISTORY);
  const [instruments, setInstruments] = useState<readonly InstrumentDto[]>([]);
  const [accounts, setAccounts] = useState<readonly AccountDto[]>([]);
  const [cashMovements, setCashMovements] = useState<readonly CashMovementDto[]>([]);
  const [page, setPage] = useState<ApplicationPage>('trades');
  const [settings, setSettings] = useState<ApplicationSettingsDto>(DEFAULT_APPLICATION_SETTINGS);
  const [trades, setTrades] = useState<readonly TradeDto[]>([]);
  const [tradePreferences, setTradePreferences] =
    useState<TradePreferencesDto>(EMPTY_TRADE_PREFERENCES);
  const [dataVersion, setDataVersion] = useState(0);
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const refreshQueued = useRef(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (refreshInFlight.current !== null) {
      refreshQueued.current = true;
      return refreshInFlight.current;
    }
    const operation = (async (): Promise<void> => {
      const [
        tradeResult,
        instrumentResult,
        accountResult,
        cashMovementResult,
        historyResult,
        settingsResult,
        tradePreferencesResult,
      ] = await Promise.all([
        gateway.listTrades(),
        gateway.listInstruments(),
        gateway.listAccounts(),
        gateway.listCashMovements(),
        gateway.getHistory(),
        gateway.getSettings(),
        gateway.getTradePreferences(),
      ]);
      if (!tradeResult.ok) {
        setError(tradeResult.error);
        return;
      }
      if (!instrumentResult.ok) {
        setError(instrumentResult.error);
        return;
      }
      if (!accountResult.ok) {
        setError(accountResult.error);
        return;
      }
      if (!cashMovementResult.ok) {
        setError(cashMovementResult.error);
        return;
      }
      if (!historyResult.ok) {
        setError(historyResult.error);
        return;
      }
      if (!settingsResult.ok) {
        setError(settingsResult.error);
        return;
      }
      if (!tradePreferencesResult.ok) {
        setError(tradePreferencesResult.error);
        return;
      }
      setTrades(tradeResult.value);
      setInstruments(instrumentResult.value);
      setAccounts(accountResult.value);
      setCashMovements(cashMovementResult.value);
      setHistory(historyResult.value);
      setSettings(settingsResult.value);
      setTradePreferences(tradePreferencesResult.value);
    })();
    const trackedOperation = operation.finally(() => {
      refreshInFlight.current = null;
      if (refreshQueued.current) {
        refreshQueued.current = false;
        void refresh();
      }
    });
    refreshInFlight.current = trackedOperation;
    return trackedOperation;
  }, [gateway]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void gateway.getDiagnostics().then((result) => {
      if (result?.ok) setVaultPath(result.value.vaultPath);
    });
  }, [gateway]);

  useEffect(() => {
    return gateway.subscribeToChanges(() => {
      setDataVersion((version) => version + 1);
      void refresh();
    });
  }, [gateway, refresh]);

  useEffect(() => {
    const language =
      settings.languageMode === 'system' ? navigator.language.slice(0, 2) : settings.languageMode;
    void i18n.changeLanguage(language === 'en' ? 'en' : 'ru');
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    document.documentElement.dataset.theme =
      settings.themeMode === 'auto' ? (mediaQuery.matches ? 'dark' : 'light') : settings.themeMode;
  }, [settings]);

  const execute = useCallback(
    async <T>(
      action: () => Promise<
        | { readonly ok: true; readonly value: T }
        | { readonly ok: false; readonly error: SafeErrorDto }
      >,
    ): Promise<T | null> => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      setError(null);
      await refresh();
      return result.value;
    },
    [refresh],
  );

  const query = useCallback(
    async <T>(
      action: () => Promise<
        | { readonly ok: true; readonly value: T }
        | { readonly ok: false; readonly error: SafeErrorDto }
      >,
    ): Promise<T | null> => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      setError(null);
      return result.value;
    },
    [],
  );

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
  const getTradeSummary = useCallback(
    (input: TradeSummaryRequestDto) => query(() => gateway.getTradeSummary(input)),
    [gateway, query],
  );

  return {
    createInstrument: (input) => execute(() => gateway.createInstrument(input)),
    createTrade: async (input) => {
      await execute(() => gateway.createTrade({ ...input, closedAt: new Date().toISOString() }));
    },
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
        return [];
      }
      return result.value;
    },
    accounts,
    cashMovements,
    dataVersion,
    vaultPath,
    deleteTrade: async (id) => {
      await execute(() => gateway.deleteTrade(id));
    },
    deleteTrades: async (ids) => {
      await execute(() => gateway.deleteTrades(ids));
    },
    error,
    getInstrumentProfile,
    getTradeSummary,
    history,
    instruments,
    page,
    redo: async () => {
      await execute(() => gateway.redo());
    },
    setPage,
    settings,
    trades,
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
    updateTrade: async (trade) => {
      await execute(() => gateway.updateTrade(trade));
    },
  };
};
