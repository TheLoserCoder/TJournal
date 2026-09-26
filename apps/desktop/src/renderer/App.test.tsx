import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { i18n } from './i18n';
import { TRANSLATION_KEYS } from './i18n-keys';

const TEST_VAULT_PATH = '/test/vault';
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
  tagIds: [],
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

interface DesktopApiMockOptions {
  readonly accounts?: readonly unknown[];
  readonly vaultPath?: string | null;
}

const createDesktopApiMock = ({
  accounts = [TEST_ACCOUNT],
  vaultPath = TEST_VAULT_PATH,
}: DesktopApiMockOptions = {}) => ({
  changes: { subscribe: vi.fn().mockReturnValue(vi.fn()) },
  diagnostics: {
    getStatus: vi.fn().mockResolvedValue({
      ok: true,
      value: { appName: 'TJournal', appVersion: '0.1.0', logsDirectory: '', vaultPath },
    }),
  },
  analytics: {
    report: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        breakdown: {
          dimension: 'instrument',
          metric: 'net-result',
          omittedGroupCount: 0,
          rows: [],
          totalGroupCount: 0,
        },
        coverage: { coveredTrades: 0, excludedTrades: 0, totalTrades: 0 },
        effectiveRange: { fromInclusive: null, grain: 'month', toExclusive: null },
        highlights: { bestInstrument: null, worstInstrument: null },
        kpis: {
          averageTradeUsd: null,
          grossLossMagnitudeUsd: null,
          grossProfitUsd: null,
          losingTrades: 0,
          maxDrawdownUsd: null,
          netResultUsd: null,
          neutralTrades: 0,
          profitFactor: null,
          winRatePercent: null,
          winningTrades: 0,
        },
        series: [],
      },
    }),
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
    list: vi.fn().mockResolvedValue({ ok: true, value: accounts }),
    update: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
    defaults: vi.fn().mockResolvedValue({ ok: true, value: [] }),
  },
  instrumentProfiles: {
    get: vi.fn().mockResolvedValue({ ok: true, value: null }),
    update: vi.fn(),
  },
  cashMovements: {
    create: vi.fn(),
    delete: vi.fn(),
    list: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    update: vi.fn(),
  },
  tags: {
    counts: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    create: vi.fn(),
    deleteMany: vi.fn(),
    list: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    update: vi.fn(),
  },
  settings: {
    get: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        languageMode: 'system',
        tableLayouts: [],
        themeMode: 'auto',
        tradeSummary: { followTableFilters: false, period: 'all' },
        statisticsView: {
          breakdownDimension: 'instrument',
          breakdownMetric: 'net-result',
          chartMetric: 'cumulative-net-result',
          chartType: 'line',
          timeGrain: 'auto',
        },
      },
    }),
    update: vi.fn(),
  },
  trades: {
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    get: vi.fn().mockResolvedValue({ ok: true, value: TEST_TRADE }),
    page: vi
      .fn()
      .mockImplementation(
        async (input: { readonly filters: { readonly instrumentIds: readonly string[] } }) => {
          const rows = [
            {
              id: `trade:${TEST_TRADE.id}`,
              kind: 'trade' as const,
              occurredAt: TEST_TRADE.closedAt,
              trade: TEST_TRADE,
            },
            {
              id: `trade:${TEST_SECOND_TRADE.id}`,
              kind: 'trade' as const,
              occurredAt: TEST_SECOND_TRADE.closedAt,
              trade: TEST_SECOND_TRADE,
            },
          ].filter(
            (row) =>
              input.filters.instrumentIds.length === 0 ||
              input.filters.instrumentIds.includes(row.trade.instrumentId),
          );
          return {
            ok: true,
            value: {
              nextCursor: null,
              previousCursor: null,
              rows,
              totalEntryCount: 2,
              unassignedTradeCount: 0,
            },
          };
        },
      ),
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
  vault: {
    backup: vi.fn(),
    backups: vi.fn().mockResolvedValue({ ok: true, value: { backups: [], nextCursor: null } }),
    verifyBackup: vi.fn(),
    restoreBackup: vi.fn(),
    create: vi.fn().mockResolvedValue({ ok: true, value: null }),
    open: vi.fn().mockResolvedValue({ ok: true, value: null }),
    revealInFolder: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { path: vaultPath ?? TEST_VAULT_PATH } }),
    validate: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { path: vaultPath ?? TEST_VAULT_PATH } }),
  },
});

const setupWindow = (
  options: DesktopApiMockOptions = {},
): ReturnType<typeof createDesktopApiMock> => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    })),
  });
  const api = createDesktopApiMock(options);
  Object.defineProperty(window, 'tjournal', {
    configurable: true,
    value: api,
  });
  return api;
};

describe('App', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the trades shell through the renderer gateway', async () => {
    setupWindow();
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: i18n.t(TRANSLATION_KEYS.navigationTrades) }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.navigationSettings) }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByText(TEST_INSTRUMENT_SYMBOL).length).toBeGreaterThan(0),
    );
    expect(
      screen.queryByText(
        i18n.t(TRANSLATION_KEYS.tableSelectedCount, {
          count: 0,
        }),
      ),
    ).not.toBeInTheDocument();

    const rowCheckbox = (
      await screen.findAllByRole('checkbox', {
        name: i18n.t(TRANSLATION_KEYS.tableSelectRow),
      })
    )[0];
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
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('cell')
          .some((cell) => cell.textContent === TEST_SECOND_INSTRUMENT_SYMBOL),
      ).toBe(false),
    );
  });

  it('opens the trade editor on a trades table row double-click', async () => {
    setupWindow();
    render(<App />);
    await screen.findByRole('heading', { name: i18n.t(TRANSLATION_KEYS.navigationTrades) });

    const table = screen.getByRole('table');
    const cell = (await within(table).findAllByText(TEST_INSTRUMENT_SYMBOL))[0];
    const row = cell?.closest('tr') ?? null;
    expect(row).not.toBeNull();
    if (row !== null) fireEvent.doubleClick(row);

    expect(await screen.findByText(i18n.t(TRANSLATION_KEYS.tradeDetails))).toBeInTheDocument();
  });

  it('opens the account editor from an accounts table row double-click', async () => {
    setupWindow();
    render(<App />);
    await screen.findByRole('heading', { name: i18n.t(TRANSLATION_KEYS.navigationTrades) });
    fireEvent.click(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.navigationAccountsAssets) }),
    );

    const table = await screen.findByRole('table');
    const row = within(table).getByText(TEST_ACCOUNT.name).closest('tr');
    expect(row).not.toBeNull();
    if (row !== null) fireEvent.doubleClick(row);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(i18n.t(TRANSLATION_KEYS.accountCostProfilesTitle));
  });

  it('blocks the workspace behind vault onboarding when no vault is open', async () => {
    setupWindow({ vaultPath: null });
    render(<App />);

    expect(
      await screen.findByText(i18n.t(TRANSLATION_KEYS.vaultOnboardingTitle)),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: i18n.t(TRANSLATION_KEYS.navigationTrades) }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionClose) }),
    ).not.toBeInTheDocument();
  });

  it('keeps Add disabled until the trade has both an asset and a result', async () => {
    setupWindow();
    render(<App />);
    await screen.findByRole('heading', { name: i18n.t(TRANSLATION_KEYS.navigationTrades) });

    const addButton = screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionAdd) });
    expect(addButton).toBeDisabled();
    expect(screen.queryByText(i18n.t(TRANSLATION_KEYS.assetCreateTitle))).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: i18n.t(TRANSLATION_KEYS.fieldAsset) }), {
      target: { value: TEST_INSTRUMENT_SYMBOL },
    });
    // A known asset alone is not enough: the result is still missing.
    expect(addButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(i18n.t(TRANSLATION_KEYS.fieldResult)), {
      target: { value: '25' },
    });
    await waitFor(() => expect(addButton).toBeEnabled());
  });

  it('offers to create an unknown asset with a chosen type', async () => {
    const api = setupWindow();
    api.instruments.create.mockResolvedValue({
      ok: true,
      value: {
        archivedAt: null,
        calculationProfile: null,
        category: 'crypto',
        createdAt: '2026-09-20T10:00:00.000Z',
        id: 'instrument-btcusd',
        source: 'custom',
        symbol: 'BTCUSD',
        updatedAt: '2026-09-20T10:00:00.000Z',
      },
    });
    api.trades.create.mockResolvedValue({ ok: true, value: TEST_TRADE });
    render(<App />);
    await screen.findByRole('heading', { name: i18n.t(TRANSLATION_KEYS.navigationTrades) });

    fireEvent.change(screen.getByRole('combobox', { name: i18n.t(TRANSLATION_KEYS.fieldAsset) }), {
      target: { value: 'BTCUSD' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: i18n.t(TRANSLATION_KEYS.fieldResult) }), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionAdd) }));

    expect(
      await screen.findByText(
        i18n.t(TRANSLATION_KEYS.assetCreateConfirmation, { symbol: 'BTCUSD' }),
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('combobox', { name: i18n.t(TRANSLATION_KEYS.fieldAssetType) }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionCreate) }));

    await waitFor(() => {
      expect(api.instruments.create).toHaveBeenCalledWith({
        category: 'forex',
        symbol: 'BTCUSD',
      });
    });
  });

  it('reaches the reworked settings page without the removed forms', async () => {
    setupWindow();
    render(<App />);
    await screen.findByRole('heading', { name: i18n.t(TRANSLATION_KEYS.navigationTrades) });

    fireEvent.click(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.navigationSettings) }),
    );

    expect(await screen.findByText(i18n.t(TRANSLATION_KEYS.settingsInterface))).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: i18n.t(TRANSLATION_KEYS.fieldTheme) }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: i18n.t(TRANSLATION_KEYS.fieldLanguage) }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('manages the vault from the settings page', async () => {
    const api = setupWindow();
    render(<App />);
    await screen.findByRole('heading', { name: i18n.t(TRANSLATION_KEYS.navigationTrades) });

    fireEvent.click(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.navigationSettings) }),
    );

    expect(await screen.findByText(i18n.t(TRANSLATION_KEYS.settingsVault))).toBeInTheDocument();
    expect(screen.getByText(TEST_VAULT_PATH)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.settingsVaultCheck) }),
    );
    await waitFor(() => expect(api.vault.validate).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(i18n.t(TRANSLATION_KEYS.settingsVaultValid)),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.settingsVaultOpenFolder) }),
    );
    await waitFor(() => expect(api.vault.revealInFolder).toHaveBeenCalledTimes(1));

    fireEvent.click(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.settingsVaultChange) }),
    );
    await waitFor(() => expect(api.vault.open).toHaveBeenCalledTimes(1));
  });

  it('resets session drafts when another vault is opened', async () => {
    const api = setupWindow();
    api.vault.open.mockResolvedValue({ ok: true, value: { path: '/test/vault-2' } });
    render(<App />);
    await screen.findByRole('heading', { name: i18n.t(TRANSLATION_KEYS.navigationTrades) });

    const resultInput = screen.getByRole('textbox', {
      name: i18n.t(TRANSLATION_KEYS.fieldResult),
    });
    fireEvent.change(resultInput, { target: { value: '25' } });
    expect(resultInput).toHaveValue('25');

    fireEvent.click(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.navigationSettings) }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.settingsVaultChange) }),
    );
    await waitFor(() => expect(api.vault.open).toHaveBeenCalledTimes(1));
    expect(screen.getByText('/test/vault-2')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.navigationTrades) }),
    );
    const resetInput = await screen.findByRole('textbox', {
      name: i18n.t(TRANSLATION_KEYS.fieldResult),
    });
    expect(resetInput).toHaveValue('');
  });

  it('opens the statistics workspace through the typed analytics API', async () => {
    setupWindow();
    render(<App />);
    await screen.findByRole('heading', { name: i18n.t(TRANSLATION_KEYS.navigationTrades) });

    fireEvent.click(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.navigationStatistics) }),
    );

    expect(
      await screen.findByRole('heading', { name: i18n.t(TRANSLATION_KEYS.navigationStatistics) }),
    ).toBeInTheDocument();
    expect(await screen.findByText(i18n.t(TRANSLATION_KEYS.statisticsEmpty))).toBeInTheDocument();
  });

  it('keeps the account onboarding dialog blocking until an account exists', async () => {
    setupWindow({ accounts: [] });
    render(<App />);

    expect(
      await screen.findByText(i18n.t(TRANSLATION_KEYS.accountOnboardingTitle)),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.accountOnboardingCreate) }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionClose) }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText(i18n.t(TRANSLATION_KEYS.accountOnboardingTitle))).toBeInTheDocument();
  });
});
