import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { i18n } from './i18n';
import { TRANSLATION_KEYS } from './i18n-keys';

const TEST_INSTRUMENT_SYMBOL = 'EURUSD';
const TEST_SECOND_INSTRUMENT_SYMBOL = 'GBPUSD';
const TEST_TRADE = {
  closedAt: '2026-09-13T12:00:00.000Z',
  direction: 'long' as const,
  execution: null,
  id: 'trade-table-layout-test',
  instrumentId: 'instrument-table-layout-test',
  instrumentSymbol: TEST_INSTRUMENT_SYMBOL,
  resultKind: 'cash' as const,
  resultSource: 'manual' as const,
  resultValue: '125.50',
  riskBindingSnapshot: null,
};
const TEST_SECOND_TRADE = {
  ...TEST_TRADE,
  id: 'trade-table-layout-test-second',
  instrumentId: 'instrument-table-layout-test-second',
  instrumentSymbol: TEST_SECOND_INSTRUMENT_SYMBOL,
};
const TEST_INSTRUMENTS = [
  {
    category: 'forex' as const,
    id: TEST_TRADE.instrumentId,
    source: 'custom' as const,
    symbol: TEST_INSTRUMENT_SYMBOL,
  },
  {
    category: 'forex' as const,
    id: TEST_SECOND_TRADE.instrumentId,
    source: 'custom' as const,
    symbol: TEST_SECOND_INSTRUMENT_SYMBOL,
  },
];
const TEST_ACCOUNT = {
  archivedAt: null,
  configuredAssetsCount: 0,
  createdAt: '2026-09-13T12:00:00.000Z',
  currentKnownBalanceUsd: '1000',
  defaultRiskUsd: null,
  id: 'account-test',
  name: 'Test account',
  openingBalanceUsd: '1000',
  uncoveredTradeCount: 0,
  updatedAt: '2026-09-13T12:00:00.000Z',
};

describe('App', () => {
  it('shows the trades shell through the renderer gateway', async () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      })),
    });
    Object.defineProperty(window, 'tjournal', {
      value: {
        diagnostics: { getStatus: vi.fn() },
        analytics: {
          summary: vi.fn().mockResolvedValue({
            ok: true,
            value: {
              bestInstrument: TEST_INSTRUMENT_SYMBOL,
              coveredTrades: 2,
              losingTrades: 0,
              neutralTrades: 0,
              totalResult: '251',
              totalTrades: 2,
              winRate: '100',
              winningTrades: 2,
              worstInstrument: null,
            },
          }),
        },
        history: {
          getState: vi.fn().mockResolvedValue({
            ok: true,
            value: { canRedo: false, canUndo: false, redoLabel: null, undoLabel: null },
          }),
          redo: vi.fn(),
          undo: vi.fn(),
        },
        instruments: {
          create: vi.fn(),
          list: vi.fn().mockResolvedValue({ ok: true, value: TEST_INSTRUMENTS }),
          update: vi.fn(),
          delete: vi.fn(),
          restore: vi.fn(),
        },
        accounts: {
          create: vi.fn(),
          list: vi.fn().mockResolvedValue({ ok: true, value: [TEST_ACCOUNT] }),
          update: vi.fn(),
          delete: vi.fn(),
          restore: vi.fn(),
          defaults: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        },
        instrumentProfiles: {
          get: vi.fn().mockResolvedValue({ ok: true, value: null }),
          update: vi.fn(),
        },
        settings: {
          get: vi.fn().mockResolvedValue({
            ok: true,
            value: {
              languageMode: 'system',
              tableLayouts: [],
              themeMode: 'auto',
              tradeSummary: { followTableFilters: false, metric: 'cash', period: 'all' },
            },
          }),
          update: vi.fn(),
        },
        trades: {
          create: vi.fn(),
          delete: vi.fn(),
          deleteMany: vi.fn(),
          list: vi.fn().mockResolvedValue({ ok: true, value: [TEST_TRADE, TEST_SECOND_TRADE] }),
          update: vi.fn(),
        },
        tradePreferences: {
          get: vi.fn().mockResolvedValue({
            ok: true,
            value: {
              neutralCostSettings: { includeCommission: false, includeSpread: false },
              neutralRanges: { cash: null, percent: null, r: null },
              riskBinding: null,
              riskPromptDismissed: false,
            },
          }),
          update: vi.fn(),
        },
        vault: { create: vi.fn(), open: vi.fn() },
      },
    });
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: i18n.t(TRANSLATION_KEYS.navigationTrades) }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.navigationSettings) }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(TEST_INSTRUMENT_SYMBOL).length).toBeGreaterThan(0);
    expect(
      screen.queryByText(
        i18n.t(TRANSLATION_KEYS.tableSelectedCount, {
          count: 0,
        }),
      ),
    ).not.toBeInTheDocument();

    const rowCheckbox = screen.getAllByRole('checkbox', {
      name: i18n.t(TRANSLATION_KEYS.tableSelectRow),
    })[0];
    expect(rowCheckbox).toBeDefined();
    if (rowCheckbox !== undefined) {
      const selectedRow = rowCheckbox.closest('tr');
      expect(selectedRow).toHaveAttribute('aria-selected', 'false');
      fireEvent.click(rowCheckbox);
      expect(selectedRow).toHaveAttribute('aria-selected', 'true');
      expect(selectedRow).toHaveAttribute('data-state', 'selected');
      expect(
        screen.queryByRole('combobox', {
          name: i18n.t(TRANSLATION_KEYS.tableEntryType),
        }),
      ).not.toBeInTheDocument();
      fireEvent.click(
        screen.getByRole('button', {
          name: i18n.t(TRANSLATION_KEYS.actionClearSelection),
        }),
      );
      expect(rowCheckbox).not.toBeChecked();
    }

    const dateFilterLabel = i18n.t(TRANSLATION_KEYS.tableFilterColumn, {
      column: i18n.t(TRANSLATION_KEYS.fieldDate),
    });
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: dateFilterLabel }));
    expect(screen.getByRole('grid')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: dateFilterLabel }));
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: dateFilterLabel }));
    expect(screen.getByRole('grid')).toBeInTheDocument();

    const assetFilterLabel = i18n.t(TRANSLATION_KEYS.tableFilterColumn, {
      column: i18n.t(TRANSLATION_KEYS.fieldAsset),
    });
    fireEvent.click(screen.getByRole('button', { name: assetFilterLabel }));
    fireEvent.click(screen.getByRole('checkbox', { name: TEST_INSTRUMENT_SYMBOL }));
    expect(
      screen
        .getAllByRole('cell')
        .some((cell) => cell.textContent === TEST_SECOND_INSTRUMENT_SYMBOL),
    ).toBe(false);
  });
});
