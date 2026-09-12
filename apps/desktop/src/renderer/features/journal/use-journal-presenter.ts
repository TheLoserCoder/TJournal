import { useCallback, useEffect, useState } from 'react';

import type {
  ApplicationSettingsDto,
  HistoryStateDto,
  InstrumentDto,
  SafeErrorDto,
  TradeDto,
} from '../../../shared/desktop-api';
import type { RendererGateway } from '../../gateway/renderer-gateway';
import { i18n } from '../../i18n';

export type ApplicationPage = 'dashboard' | 'settings' | 'statistics' | 'trades';

export interface JournalPresenter {
  readonly error: SafeErrorDto | null;
  readonly history: HistoryStateDto;
  readonly instruments: readonly InstrumentDto[];
  readonly page: ApplicationPage;
  readonly settings: ApplicationSettingsDto;
  readonly trades: readonly TradeDto[];
  createInstrument(symbol: string): Promise<InstrumentDto | null>;
  createTrade(input: {
    instrumentId: string;
    resultKind: 'cash' | 'percent';
    resultValue: string;
  }): Promise<void>;
  deleteTrade(id: string): Promise<void>;
  redo(): Promise<void>;
  setPage(page: ApplicationPage): void;
  updateSettings(settings: ApplicationSettingsDto): Promise<void>;
  updateTrade(trade: TradeDto): Promise<void>;
  undo(): Promise<void>;
}

const EMPTY_HISTORY: HistoryStateDto = {
  canRedo: false,
  canUndo: false,
  redoLabel: null,
  undoLabel: null,
};
const DEFAULT_SETTINGS: ApplicationSettingsDto = { languageMode: 'system', themeMode: 'auto' };

export const useJournalPresenter = (gateway: RendererGateway): JournalPresenter => {
  const [error, setError] = useState<SafeErrorDto | null>(null);
  const [history, setHistory] = useState<HistoryStateDto>(EMPTY_HISTORY);
  const [instruments, setInstruments] = useState<readonly InstrumentDto[]>([]);
  const [page, setPage] = useState<ApplicationPage>('trades');
  const [settings, setSettings] = useState<ApplicationSettingsDto>(DEFAULT_SETTINGS);
  const [trades, setTrades] = useState<readonly TradeDto[]>([]);

  const refresh = useCallback(async (): Promise<void> => {
    const [tradeResult, instrumentResult, historyResult, settingsResult] = await Promise.all([
      gateway.listTrades(),
      gateway.listInstruments(),
      gateway.getHistory(),
      gateway.getSettings(),
    ]);
    if (!tradeResult.ok) {
      setError(tradeResult.error);
      return;
    }
    if (!instrumentResult.ok) {
      setError(instrumentResult.error);
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
    setTrades(tradeResult.value);
    setInstruments(instrumentResult.value);
    setHistory(historyResult.value);
    setSettings(settingsResult.value);
  }, [gateway]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  return {
    createInstrument: (symbol) =>
      execute(() => gateway.createInstrument({ category: 'forex', symbol })),
    createTrade: async (input) => {
      await execute(() => gateway.createTrade({ ...input, closedAt: new Date().toISOString() }));
    },
    deleteTrade: async (id) => {
      await execute(() => gateway.deleteTrade(id));
    },
    error,
    history,
    instruments,
    page,
    redo: async () => {
      await execute(() => gateway.redo());
    },
    setPage,
    settings,
    trades,
    undo: async () => {
      await execute(() => gateway.undo());
    },
    updateSettings: async (value) => {
      await execute(() => gateway.updateSettings(value));
    },
    updateTrade: async (trade) => {
      await execute(() => gateway.updateTrade(trade));
    },
  };
};
