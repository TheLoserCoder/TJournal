import { act, renderHook, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_APPLICATION_SETTINGS } from '../../../shared/application-settings';
import type { AccountDto, InstrumentDto } from '../../../shared/desktop-api';
import { i18n } from '../../i18n';
import type { JournalPresenter } from './use-journal-presenter';
import { useJournalWorkspacePresenter } from './use-journal-workspace-presenter';

const ACCOUNT: AccountDto = {
  archivedAt: null,
  configuredAssetsCount: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  currentKnownBalanceUsd: '1000',
  defaultRiskUsd: null,
  id: 'account-1',
  name: 'Primary',
  openingBalanceUsd: '1000',
  uncoveredTradeCount: 0,
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const EURUSD: InstrumentDto = {
  archivedAt: null,
  calculationProfile: null,
  category: 'forex',
  createdAt: '2026-09-01T00:00:00.000Z',
  id: 'asset-1',
  source: 'custom',
  symbol: 'EURUSD',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const EMPTY_PAGE = {
  nextCursor: null,
  previousCursor: null,
  rows: [],
  totalEntryCount: 0,
  unassignedTradeCount: 0,
};

const createJournal = () => ({
  accounts: [ACCOUNT],
  createAccount: vi.fn().mockResolvedValue(ACCOUNT),
  createCashMovement: vi.fn().mockResolvedValue(null),
  createInstrument: vi.fn().mockResolvedValue(EURUSD),
  createTag: vi.fn().mockResolvedValue(null),
  createTrade: vi.fn().mockResolvedValue(true),
  createVaultBackup: vi.fn().mockResolvedValue({ ok: true, value: null }),
  dataVersion: 1,
  deleteAccount: vi.fn().mockResolvedValue(ACCOUNT),
  deleteCashMovement: vi.fn().mockResolvedValue(null),
  deleteInstrument: vi.fn().mockResolvedValue(EURUSD),
  deleteTags: vi.fn().mockResolvedValue(true),
  deleteTrades: vi.fn().mockResolvedValue(undefined),
  getAnalyticsReport: vi.fn().mockResolvedValue(null),
  getInstrumentProfile: vi.fn().mockResolvedValue(null),
  getJournalPage: vi.fn().mockResolvedValue(EMPTY_PAGE),
  getTrade: vi.fn().mockResolvedValue(null),
  getTradeSummary: vi.fn().mockResolvedValue(null),
  instruments: [EURUSD],
  listAccountDefaults: vi.fn().mockResolvedValue([]),
  listVaultBackups: vi
    .fn()
    .mockResolvedValue({ ok: true, value: { backups: [], nextCursor: null } }),
  page: 'catalog' as const,
  restoreAccount: vi.fn().mockResolvedValue(ACCOUNT),
  restoreInstrument: vi.fn().mockResolvedValue(EURUSD),
  restoreVaultBackup: vi.fn().mockResolvedValue({ ok: true, value: null }),
  revealVaultFolder: vi.fn().mockResolvedValue({ ok: true, value: null }),
  settings: DEFAULT_APPLICATION_SETTINGS,
  tagTradeCounts: {},
  tags: [],
  tradePreferences: {
    neutralCostSettings: { includeCommission: false, includeSpread: false },
    neutralRanges: { cash: null, percent: null, r: null },
    riskBinding: null,
    riskPromptDismissed: false,
  },
  updateAccount: vi.fn().mockResolvedValue({ ...ACCOUNT, defaultRiskUsd: '150' }),
  updateCashMovement: vi.fn().mockResolvedValue(null),
  updateInstrument: vi.fn().mockResolvedValue(EURUSD),
  updateSettings: vi.fn().mockResolvedValue(undefined),
  updateTableLayout: vi.fn().mockResolvedValue(undefined),
  updateTag: vi.fn().mockResolvedValue(null),
  updateTrade: vi.fn().mockResolvedValue(true),
  updateTradePreferences: vi.fn().mockResolvedValue(undefined),
  validateVault: vi.fn().mockResolvedValue({ ok: true, value: null }),
  vaultPath: 'C:\\vault',
});

const wrapper = ({ children }: { readonly children: ReactNode }): ReactElement => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

const renderPresenter = (journal: ReturnType<typeof createJournal>) =>
  renderHook(() => useJournalWorkspacePresenter(journal as unknown as JournalPresenter), {
    wrapper,
  });

const waitForSelection = async (result: {
  readonly current: ReturnType<typeof useJournalWorkspacePresenter>;
}): Promise<void> => {
  await waitFor(() => expect(result.current.accountId).toBe(ACCOUNT.id));
};

describe('useJournalWorkspacePresenter account risk', () => {
  it('stores the table-settings 1R with the loaded profiles before applying the layout', async () => {
    const journal = createJournal();
    const { result } = renderPresenter(journal);
    await waitForSelection(result);

    act(() => {
      result.current.setTableLayoutOpen(true);
      result.current.setTableLayoutRiskUsd('150');
    });
    act(() => result.current.applyTableLayout());

    await waitFor(() => expect(journal.updateAccount).toHaveBeenCalledTimes(1));
    expect(journal.updateAccount).toHaveBeenCalledWith({
      defaultRiskUsd: '150',
      defaults: [],
      id: ACCOUNT.id,
      name: ACCOUNT.name,
      openingBalanceUsd: ACCOUNT.openingBalanceUsd,
    });
    await waitFor(() => expect(result.current.tableLayoutOpen).toBe(false));
    expect(result.current.riskUsd).toBe('150');
  });

  it('never writes the account when the profile read fails and keeps the dialog open', async () => {
    const journal = createJournal();
    let resolveDefaults!: (value: null) => void;
    journal.listAccountDefaults.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resolveDefaults = resolve;
        }),
    );
    const { result } = renderPresenter(journal);
    await waitForSelection(result);

    act(() => {
      result.current.setTableLayoutOpen(true);
      result.current.setTableLayoutRiskUsd('150');
    });
    act(() => result.current.applyTableLayout());

    await act(async () => {
      resolveDefaults(null);
    });

    expect(journal.updateAccount).not.toHaveBeenCalled();
    expect(result.current.tableLayoutOpen).toBe(true);
    expect(result.current.riskUsd).toBe('');
  });

  it('does not repeat the account write for an already stored risk', async () => {
    const journal = createJournal();
    const { result } = renderPresenter(journal);
    await waitForSelection(result);

    act(() => {
      result.current.setTableLayoutOpen(true);
      result.current.setTableLayoutRiskUsd('150');
    });
    act(() => result.current.applyTableLayout());
    await waitFor(() => expect(journal.updateAccount).toHaveBeenCalledTimes(1));

    act(() => result.current.setTableLayoutOpen(true));
    act(() => result.current.applyTableLayout());
    await act(async () => {});

    expect(journal.updateAccount).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.tableLayoutOpen).toBe(false));
  });
});

describe('useJournalWorkspacePresenter quick entry', () => {
  it('keeps the typed result when the trade is rejected and clears it after success', async () => {
    const journal = createJournal();
    journal.createTrade.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = renderPresenter(journal);
    await waitForSelection(result);

    act(() => {
      result.current.setSymbol('EURUSD');
      result.current.setResultValue('25');
    });

    await act(async () => {
      await result.current.createTrade();
    });
    expect(result.current.resultValue).toBe('25');

    await act(async () => {
      await result.current.createTrade();
    });
    expect(result.current.resultValue).toBe('');
  });

  it('reports an empty legacy lookup instead of opening nothing', async () => {
    const journal = createJournal();
    const { result } = renderPresenter(journal);
    await waitForSelection(result);

    await act(async () => {
      result.current.openLegacyMigration();
    });

    expect(journal.getJournalPage).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ includeUnassigned: true }),
        includeCashMovements: false,
        limit: 1,
      }),
    );
    expect(result.current.legacyLookupEmpty).toBe(true);
  });

  it('reuses a created asset when the trade retry follows', async () => {
    const journal = createJournal();
    journal.instruments = [];
    journal.createTrade.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = renderPresenter(journal);
    await waitForSelection(result);

    act(() => {
      result.current.setSymbol('eurusd');
      result.current.setResultValue('25');
    });

    await act(async () => {
      expect(await result.current.createTrade()).toBe('asset-confirmation');
    });
    expect(result.current.confirmSymbol).toBe('EURUSD');

    await act(async () => {
      expect(await result.current.confirmAssetAndCreateTrade()).toBe(false);
    });
    expect(journal.createInstrument).toHaveBeenCalledTimes(1);
    expect(result.current.confirmSymbol).toBe('EURUSD');

    await act(async () => {
      expect(await result.current.confirmAssetAndCreateTrade()).toBe(true);
    });
    expect(journal.createInstrument).toHaveBeenCalledTimes(1);
    expect(result.current.confirmSymbol).toBeNull();
  });
});
