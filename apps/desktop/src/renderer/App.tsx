import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import type { SafeErrorDto, TradeDto } from '../shared/desktop-api';
import './i18n';
import { useThemeMode } from './use-theme-mode';

interface TradeFormState {
  readonly instrument: string;
  readonly resultKind: 'cash' | 'percent';
  readonly resultValue: string;
}

const INITIAL_TRADE: TradeFormState = { instrument: '', resultKind: 'cash', resultValue: '' };

export const App = (): ReactElement => {
  const { t } = useTranslation();
  const [error, setError] = useState<SafeErrorDto | null>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [trade, setTrade] = useState(INITIAL_TRADE);
  const [trades, setTrades] = useState<readonly TradeDto[]>([]);
  const [themeMode, setThemeMode] = useThemeMode();

  const loadTrades = async (): Promise<void> => {
    const result = await window.tjournal.trades.list();
    if (result.ok) setTrades(result.value);
    else setError(result.error);
  };

  useEffect(() => {
    void window.tjournal.diagnostics.getStatus().then((result) => {
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const isOpen = result.value.vaultPath !== null;
      setVaultOpen(isOpen);
      if (isOpen) void loadTrades();
    });
  }, []);

  const chooseVault = async (action: 'create' | 'open'): Promise<void> => {
    const result = await window.tjournal.vault[action]();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.value !== null) {
      setError(null);
      setVaultOpen(true);
      await loadTrades();
    }
  };

  const saveTrade = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const result = await window.tjournal.trades.create({
      ...trade,
      closedAt: new Date().toISOString(),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTrades((current) => [result.value, ...current]);
    setTrade(INITIAL_TRADE);
  };

  const errorMessage =
    error === null ? null : <p className="error-message">{t(`error.${error.code}`)}</p>;

  if (!vaultOpen)
    return (
      <main className="app-shell">
        <section className="welcome-card">
          <p className="eyebrow">TJournal</p>
          <h1>{t('onboarding.title')}</h1>
          <p className="description">{t('onboarding.description')}</p>
          {errorMessage}
          <div className="actions">
            <button onClick={() => void chooseVault('create')} type="button">
              {t('onboarding.create')}
            </button>
            <button
              className="secondary-button"
              onClick={() => void chooseVault('open')}
              type="button"
            >
              {t('onboarding.open')}
            </button>
          </div>
        </section>
      </main>
    );

  return (
    <main className="journal-layout">
      <header className="journal-header">
        <p className="eyebrow">{t('app.title')}</p>
        <h1>{t('journal.title')}</h1>
        <label className="theme-picker">
          {t('theme.label')}
          <select
            onChange={(event) => setThemeMode(event.target.value as 'auto' | 'dark' | 'light')}
            value={themeMode}
          >
            <option value="auto">{t('theme.auto')}</option>
            <option value="light">{t('theme.light')}</option>
            <option value="dark">{t('theme.dark')}</option>
          </select>
        </label>
      </header>
      {errorMessage}
      <section className="trade-card">
        <h2>{t('trade.add')}</h2>
        <form className="trade-form" onSubmit={(event) => void saveTrade(event)}>
          <label>
            {t('trade.instrument')}
            <input
              required
              value={trade.instrument}
              onChange={(event) => setTrade({ ...trade, instrument: event.target.value })}
            />
          </label>
          <label>
            {t('trade.result')}
            <input
              required
              inputMode="decimal"
              value={trade.resultValue}
              onChange={(event) => setTrade({ ...trade, resultValue: event.target.value })}
            />
          </label>
          <label>
            {t('trade.result')}
            <select
              value={trade.resultKind}
              onChange={(event) =>
                setTrade({ ...trade, resultKind: event.target.value as 'cash' | 'percent' })
              }
            >
              <option value="cash">{t('trade.cash')}</option>
              <option value="percent">{t('trade.percent')}</option>
            </select>
          </label>
          <button type="submit">{t('trade.save')}</button>
        </form>
      </section>
      <section className="trade-card">
        <h2>{t('journal.title')}</h2>
        {trades.length === 0 ? (
          <p className="description">{t('journal.empty')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('trade.instrument')}</th>
                <th>{t('trade.result')}</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((item) => (
                <tr key={item.id}>
                  <td>{item.instrument}</td>
                  <td>{item.resultValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
};
