import { useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { BarChart3, Home, Redo2, Settings, Table2, Undo2 } from 'lucide-react';

import type { TradeDto } from '../../../shared/desktop-api';
import { Combobox } from '../../components/combobox';
import { ConfirmModal } from '../../components/confirm-modal';
import { Modal } from '../../components/modal';
import { PageHeader } from '../../components/page-header';
import type { JournalPresenter } from './use-journal-presenter';

const NAVIGATION = [
  { icon: Home, id: 'dashboard', label: 'Главная' },
  { icon: Table2, id: 'trades', label: 'Сделки' },
  { icon: BarChart3, id: 'statistics', label: 'Статистика' },
  { icon: Settings, id: 'settings', label: 'Настройки' },
] as const;

export const JournalView = ({
  presenter,
}: {
  readonly presenter: JournalPresenter;
}): ReactElement => {
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
        <PageHeader title="Сделки" />
        <form className="quick-form" onSubmit={(event) => void create(event)}>
          <Combobox
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
            <option value="cash">USD</option>
            <option value="percent">%</option>
          </select>
          <button type="submit">Создать</button>
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
            Подробнее
          </button>
        </form>
        <input
          aria-label="Поиск сделок"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск актива"
          value={search}
        />
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Актив</th>
              <th>Результат</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {matchingTrades.map((trade) => (
              <tr key={trade.id}>
                <td>{new Date(trade.closedAt).toLocaleDateString()}</td>
                <td>{trade.instrumentSymbol}</td>
                <td>
                  {trade.resultValue} {trade.resultKind === 'cash' ? 'USD' : '%'}
                </td>
                <td>
                  <button onClick={() => setEditing(trade)} type="button">
                    Изменить
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void presenter.deleteTrade(trade.id)}
                    type="button"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    ) : presenter.page === 'settings' ? (
      <section>
        <PageHeader title="Настройки" />
        <label>
          Тема
          <select
            onChange={(event) =>
              void presenter.updateSettings({
                ...presenter.settings,
                themeMode: event.target.value as 'auto' | 'dark' | 'light',
              })
            }
            value={presenter.settings.themeMode}
          >
            <option value="auto">Авто</option>
            <option value="light">Светлая</option>
            <option value="dark">Тёмная</option>
          </select>
        </label>
        <label>
          Язык
          <select
            onChange={(event) =>
              void presenter.updateSettings({
                ...presenter.settings,
                languageMode: event.target.value as 'system' | 'ru' | 'en',
              })
            }
            value={presenter.settings.languageMode}
          >
            <option value="system">Системный</option>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </label>
      </section>
    ) : (
      <section>
        <PageHeader title={presenter.page === 'dashboard' ? 'Главная' : 'Статистика'} />
        <p>В разработке.</p>
      </section>
    );
  return (
    <main className="desktop-shell">
      <aside className="sidebar">
        <div className="history-actions">
          <button
            disabled={!presenter.history.canUndo}
            onClick={() => void presenter.undo()}
            title="Отменить (Ctrl+Z)"
            type="button"
          >
            <Undo2 />
          </button>
          <button
            disabled={!presenter.history.canRedo}
            onClick={() => void presenter.redo()}
            title="Повторить (Ctrl+Y)"
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
            <span>{item.label}</span>
          </button>
        ))}
      </aside>
      <div className="page-content">
        {presenter.error !== null && <p className="error-message">{presenter.error.code}</p>}
        {content}
      </div>
      {confirmSymbol !== null && (
        <ConfirmModal
          confirmLabel="Создать"
          message={`Создать новый актив ${confirmSymbol}?`}
          onCancel={() => setConfirmSymbol(null)}
          onConfirm={() => void createAssetAndTrade()}
          title="Новый актив"
        />
      )}
      {editing !== null && (
        <Modal title="Детали сделки">
          <label>
            Дата
            <input
              onChange={(event) =>
                setEditing({ ...editing, closedAt: new Date(event.target.value).toISOString() })
              }
              type="datetime-local"
              value={editing.closedAt.slice(0, 16)}
            />
          </label>
          <label>
            Результат
            <input
              onChange={(event) => setEditing({ ...editing, resultValue: event.target.value })}
              value={editing.resultValue}
            />
          </label>
          <div className="actions">
            <button className="secondary-button" onClick={() => setEditing(null)} type="button">
              Отмена
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
              Сохранить
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
};
