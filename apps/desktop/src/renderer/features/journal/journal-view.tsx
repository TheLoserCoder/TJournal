import { useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { BarChart3, Home, Redo2, Settings, Table2, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { TradeDto } from '../../../shared/desktop-api';
import { Combobox } from '../../components/combobox';
import { ConfirmModal } from '../../components/confirm-modal';
import { Modal } from '../../components/modal';
import { PageHeader } from '../../components/page-header';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import type { JournalPresenter } from './use-journal-presenter';

const NAVIGATION = [
  { icon: Home, id: 'dashboard', labelKey: TRANSLATION_KEYS.navigationDashboard },
  { icon: Table2, id: 'trades', labelKey: TRANSLATION_KEYS.navigationTrades },
  { icon: BarChart3, id: 'statistics', labelKey: TRANSLATION_KEYS.navigationStatistics },
  { icon: Settings, id: 'settings', labelKey: TRANSLATION_KEYS.navigationSettings },
] as const;

export const JournalView = ({
  presenter,
}: {
  readonly presenter: JournalPresenter;
}): ReactElement => {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useState('');
  const [resultKind, setResultKind] = useState<'cash' | 'percent'>('cash');
  const [resultValue, setResultValue] = useState('');
  const [confirmSymbol, setConfirmSymbol] = useState<string | null>(null);
  const [editing, setEditing] = useState<TradeDto | null>(null);
  const [search, setSearch] = useState('');
  const instruments = presenter.instruments;
  const matchingTrades = useMemo(
    () => presenter.trades.filter((trade) => trade.instrumentSymbol.includes(search.toUpperCase())),
    [presenter.trades, search],
  );
  const create = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const selected = instruments.find(
      (instrument) => instrument.symbol === symbol.trim().toUpperCase(),
    );
    if (selected === undefined) {
      setConfirmSymbol(symbol.trim().toUpperCase());
      return;
    }
    await presenter.createTrade({ instrumentId: selected.id, resultKind, resultValue });
    setResultValue('');
  };
  const createAssetAndTrade = async (): Promise<void> => {
    if (confirmSymbol === null) return;
    const instrument = await presenter.createInstrument(confirmSymbol);
    setConfirmSymbol(null);
    if (instrument !== null) {
      await presenter.createTrade({ instrumentId: instrument.id, resultKind, resultValue });
      setResultValue('');
    }
  };
  const content =
    presenter.page === 'trades' ? (
      <section>
        <PageHeader title={t(TRANSLATION_KEYS.navigationTrades)} />
        <form className="quick-form" onSubmit={(event) => void create(event)}>
          <Combobox
            ariaLabel={t(TRANSLATION_KEYS.fieldAsset)}
            onChange={setSymbol}
            options={instruments.map((instrument) => instrument.symbol)}
            value={symbol}
          />
          <input
            inputMode="decimal"
            onChange={(event) => setResultValue(event.target.value)}
            required
            value={resultValue}
          />
          <select
            onChange={(event) => setResultKind(event.target.value as 'cash' | 'percent')}
            value={resultKind}
          >
            <option value="cash">{t(TRANSLATION_KEYS.tradeUnitCash)}</option>
            <option value="percent">{t(TRANSLATION_KEYS.tradeUnitPercent)}</option>
          </select>
          <button type="submit">{t(TRANSLATION_KEYS.actionCreate)}</button>
          <button
            className="secondary-button"
            onClick={() =>
              setEditing({
                closedAt: new Date().toISOString(),
                id: '',
                instrumentId: instruments[0]?.id ?? '',
                instrumentSymbol: symbol,
                resultKind,
                resultValue,
              })
            }
            type="button"
          >
            {t(TRANSLATION_KEYS.tradeDetails)}
          </button>
        </form>
        <input
          aria-label={t(TRANSLATION_KEYS.searchTrades)}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t(TRANSLATION_KEYS.searchAssets)}
          value={search}
        />
        <table>
          <thead>
            <tr>
              <th>{t(TRANSLATION_KEYS.fieldDate)}</th>
              <th>{t(TRANSLATION_KEYS.fieldAsset)}</th>
              <th>{t(TRANSLATION_KEYS.fieldResult)}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {matchingTrades.map((trade) => (
              <tr key={trade.id}>
                <td>{new Date(trade.closedAt).toLocaleDateString()}</td>
                <td>{trade.instrumentSymbol}</td>
                <td>
                  {trade.resultValue}{' '}
                  {t(
                    trade.resultKind === 'cash'
                      ? TRANSLATION_KEYS.tradeUnitCash
                      : TRANSLATION_KEYS.tradeUnitPercent,
                  )}
                </td>
                <td>
                  <button onClick={() => setEditing(trade)} type="button">
                    {t(TRANSLATION_KEYS.actionEdit)}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void presenter.deleteTrade(trade.id)}
                    type="button"
                  >
                    {t(TRANSLATION_KEYS.actionDelete)}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    ) : presenter.page === 'settings' ? (
      <section>
        <PageHeader title={t(TRANSLATION_KEYS.navigationSettings)} />
        <label>
          {t(TRANSLATION_KEYS.fieldTheme)}
          <select
            onChange={(event) =>
              void presenter.updateSettings({
                ...presenter.settings,
                themeMode: event.target.value as 'auto' | 'dark' | 'light',
              })
            }
            value={presenter.settings.themeMode}
          >
            <option value="auto">{t(TRANSLATION_KEYS.themeAuto)}</option>
            <option value="light">{t(TRANSLATION_KEYS.themeLight)}</option>
            <option value="dark">{t(TRANSLATION_KEYS.themeDark)}</option>
          </select>
        </label>
        <label>
          {t(TRANSLATION_KEYS.fieldLanguage)}
          <select
            onChange={(event) =>
              void presenter.updateSettings({
                ...presenter.settings,
                languageMode: event.target.value as 'system' | 'ru' | 'en',
              })
            }
            value={presenter.settings.languageMode}
          >
            <option value="system">{t(TRANSLATION_KEYS.languageSystem)}</option>
            <option value="ru">{t(TRANSLATION_KEYS.languageRussian)}</option>
            <option value="en">{t(TRANSLATION_KEYS.languageEnglish)}</option>
          </select>
        </label>
      </section>
    ) : (
      <section>
        <PageHeader
          title={t(
            presenter.page === 'dashboard'
              ? TRANSLATION_KEYS.navigationDashboard
              : TRANSLATION_KEYS.navigationStatistics,
          )}
        />
        <p>{t(TRANSLATION_KEYS.pageComingSoon)}</p>
      </section>
    );
  return (
    <main className="desktop-shell">
      <aside className="sidebar">
        <div className="history-actions">
          <button
            disabled={!presenter.history.canUndo}
            onClick={() => void presenter.undo()}
            title={`${t(TRANSLATION_KEYS.actionUndo)} (Ctrl+Z)`}
            type="button"
          >
            <Undo2 />
          </button>
          <button
            disabled={!presenter.history.canRedo}
            onClick={() => void presenter.redo()}
            title={`${t(TRANSLATION_KEYS.actionRedo)} (Ctrl+Y)`}
            type="button"
          >
            <Redo2 />
          </button>
        </div>
        {NAVIGATION.map((item) => (
          <button
            className={presenter.page === item.id ? 'navigation-item active' : 'navigation-item'}
            key={item.id}
            onClick={() => presenter.setPage(item.id)}
            type="button"
          >
            <item.icon />
            <span>{t(item.labelKey)}</span>
          </button>
        ))}
      </aside>
      <div className="page-content">
        {presenter.error !== null && <p className="error-message">{presenter.error.code}</p>}
        {content}
      </div>
      {confirmSymbol !== null && (
        <ConfirmModal
          cancelLabel={t(TRANSLATION_KEYS.actionCancel)}
          confirmLabel={t(TRANSLATION_KEYS.actionCreate)}
          message={t(TRANSLATION_KEYS.assetCreateConfirmation, { symbol: confirmSymbol })}
          onCancel={() => setConfirmSymbol(null)}
          onConfirm={() => void createAssetAndTrade()}
          title={t(TRANSLATION_KEYS.assetCreateTitle)}
        />
      )}
      {editing !== null && (
        <Modal title={t(TRANSLATION_KEYS.tradeDetails)}>
          <label>
            {t(TRANSLATION_KEYS.fieldDate)}
            <input
              onChange={(event) =>
                setEditing({ ...editing, closedAt: new Date(event.target.value).toISOString() })
              }
              type="datetime-local"
              value={editing.closedAt.slice(0, 16)}
            />
          </label>
          <label>
            {t(TRANSLATION_KEYS.fieldResult)}
            <input
              onChange={(event) => setEditing({ ...editing, resultValue: event.target.value })}
              value={editing.resultValue}
            />
          </label>
          <div className="actions">
            <button className="secondary-button" onClick={() => setEditing(null)} type="button">
              {t(TRANSLATION_KEYS.actionCancel)}
            </button>
            <button
              onClick={() => {
                if (editing.id === '') {
                  const selected = instruments.find(
                    (item) => item.symbol === editing.instrumentSymbol.toUpperCase(),
                  );
                  if (selected !== undefined)
                    void presenter.createTrade({
                      instrumentId: selected.id,
                      resultKind: editing.resultKind,
                      resultValue: editing.resultValue,
                    });
                } else void presenter.updateTrade(editing);
                setEditing(null);
              }}
              type="button"
            >
              {t(TRANSLATION_KEYS.actionSave)}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
};
