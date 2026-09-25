import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type {
  AccountDto,
  AccountInstrumentDefaultsDto,
  InstrumentDto,
} from '../../../shared/desktop-api';
import type { JournalPresenter } from './use-journal-presenter';
import { useCatalogPresenter } from './use-catalog-presenter';

const ACCOUNT: AccountDto = {
  archivedAt: null,
  configuredAssetsCount: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  currentKnownBalanceUsd: '1000',
  defaultRiskUsd: null,
  id: 'account-1',
  name: 'Primary',
  openingBalanceUsd: '1000',
  uncoveredTradeCount: 0,
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const SECOND_ACCOUNT: AccountDto = { ...ACCOUNT, id: 'account-2', name: 'Second' };

const asset = (id: string, symbol: string, archivedAt: string | null = null): InstrumentDto => ({
  archivedAt,
  calculationProfile: null,
  category: 'forex',
  createdAt: '2026-09-01T00:00:00.000Z',
  id,
  source: 'custom',
  symbol,
  updatedAt: '2026-09-01T00:00:00.000Z',
});

const EURUSD = asset('asset-1', 'EURUSD');
const GBPUSD = asset('asset-2', 'GBPUSD');
const ARCHIVED = asset('asset-3', 'OLD', '2026-09-02T00:00:00.000Z');

const TEST_TAG = {
  color: 'indigo' as const,
  createdAt: '2026-09-01T00:00:00.000Z',
  description: '',
  id: 'tag-1',
  name: 'A',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const defaultsRow = (instrumentId: string): AccountInstrumentDefaultsDto => ({
  accountId: ACCOUNT.id,
  commissionUsd: '1',
  instrumentId,
  spreadTicks: '2',
  updatedAt: '2026-09-01T00:00:00.000Z',
});

const createJournal = () => ({
  createAccount: vi.fn().mockResolvedValue(ACCOUNT),
  createInstrument: vi.fn().mockResolvedValue(EURUSD),
  createTag: vi.fn().mockResolvedValue(TEST_TAG),
  deleteAccount: vi.fn().mockResolvedValue(ACCOUNT),
  deleteInstrument: vi.fn().mockResolvedValue(EURUSD),
  deleteTags: vi.fn().mockResolvedValue(true),
  instruments: [EURUSD, GBPUSD, ARCHIVED],
  listAccountDefaults: vi.fn().mockResolvedValue([]),
  restoreAccount: vi.fn().mockResolvedValue(ACCOUNT),
  restoreInstrument: vi.fn().mockResolvedValue(EURUSD),
  settings: { tableLayouts: [] },
  tagTradeCounts: {},
  tags: [],
  updateAccount: vi.fn().mockResolvedValue(ACCOUNT),
  updateInstrument: vi.fn().mockResolvedValue(EURUSD),
  updateTableLayout: vi.fn().mockResolvedValue(undefined),
  updateTag: vi.fn().mockResolvedValue(TEST_TAG),
});

type FakeJournal = ReturnType<typeof createJournal>;

const renderPresenter = (journal: FakeJournal) =>
  renderHook(() => useCatalogPresenter(journal as unknown as JournalPresenter));

describe('useCatalogPresenter account profiles', () => {
  it('loads profiles before the save and closes the editor after success', async () => {
    const journal = createJournal();
    journal.listAccountDefaults.mockResolvedValue([defaultsRow(EURUSD.id)]);
    const { result } = renderPresenter(journal);

    act(() => result.current.openAccountEditor(ACCOUNT));
    expect(result.current.accountDefaultsStatus).toBe('loading');
    expect(result.current.accountDraft.name).toBe(ACCOUNT.name);

    await waitFor(() => expect(result.current.accountDefaultsStatus).toBe('ready'));
    expect(result.current.accountDraft.defaults).toEqual([
      { commissionUsd: '1', instrumentId: EURUSD.id, spreadTicks: '2' },
    ]);

    let saved = false;
    await act(async () => {
      saved = await result.current.submitAccountDraft();
    });

    expect(saved).toBe(true);
    expect(journal.updateAccount).toHaveBeenCalledWith({
      defaults: [{ commissionUsd: '1', instrumentId: EURUSD.id, spreadTicks: '2' }],
      id: ACCOUNT.id,
      name: ACCOUNT.name,
      openingBalanceUsd: ACCOUNT.openingBalanceUsd,
    });
    expect(result.current.accountEditorOpen).toBe(false);
  });

  it('rejects a save while the profiles are still loading', async () => {
    const journal = createJournal();
    journal.listAccountDefaults.mockImplementation(
      () => new Promise<readonly AccountInstrumentDefaultsDto[]>(() => {}),
    );
    const { result } = renderPresenter(journal);

    act(() => result.current.openAccountEditor(ACCOUNT));
    let saved = true;
    await act(async () => {
      saved = await result.current.submitAccountDraft();
    });

    expect(saved).toBe(false);
    expect(journal.updateAccount).not.toHaveBeenCalled();
    expect(result.current.accountEditorOpen).toBe(true);
  });

  it('keeps every saved profile when the read fails and recovers on retry', async () => {
    const journal = createJournal();
    journal.listAccountDefaults.mockResolvedValue(null);
    const { result } = renderPresenter(journal);

    act(() => result.current.openAccountEditor(ACCOUNT));
    await waitFor(() => expect(result.current.accountDefaultsStatus).toBe('error'));

    let saved = true;
    await act(async () => {
      saved = await result.current.submitAccountDraft();
    });
    expect(saved).toBe(false);
    expect(journal.updateAccount).not.toHaveBeenCalled();

    journal.listAccountDefaults.mockResolvedValue([defaultsRow(EURUSD.id)]);
    act(() => result.current.retryAccountDefaults());
    await waitFor(() => expect(result.current.accountDefaultsStatus).toBe('ready'));
    expect(result.current.accountDraft.defaults).toHaveLength(1);
  });

  it('keeps the editor and the draft when the account write is rejected', async () => {
    const journal = createJournal();
    journal.listAccountDefaults.mockResolvedValue([defaultsRow(EURUSD.id)]);
    journal.updateAccount.mockResolvedValue(null);
    const { result } = renderPresenter(journal);

    act(() => result.current.openAccountEditor(ACCOUNT));
    await waitFor(() => expect(result.current.accountDefaultsStatus).toBe('ready'));

    let saved = true;
    await act(async () => {
      saved = await result.current.submitAccountDraft();
    });

    expect(saved).toBe(false);
    expect(result.current.accountEditorOpen).toBe(true);
    expect(result.current.accountDraft.defaults).toHaveLength(1);
  });

  it('ignores a response for a previously opened account', async () => {
    const journal = createJournal();
    const pending: ((value: readonly AccountInstrumentDefaultsDto[]) => void)[] = [];
    journal.listAccountDefaults.mockImplementation(
      () =>
        new Promise<readonly AccountInstrumentDefaultsDto[]>((resolve) => {
          pending.push(resolve);
        }),
    );
    const { result } = renderPresenter(journal);

    act(() => result.current.openAccountEditor(ACCOUNT));
    act(() => result.current.openAccountEditor(SECOND_ACCOUNT));
    await waitFor(() => expect(pending).toHaveLength(2));

    await act(async () => {
      pending[1]?.([defaultsRow(GBPUSD.id)]);
    });
    await act(async () => {
      pending[0]?.([defaultsRow(EURUSD.id)]);
    });

    expect(result.current.accountDraft.defaults).toEqual([
      { commissionUsd: '1', instrumentId: GBPUSD.id, spreadTicks: '2' },
    ]);
  });

  it('does not read profiles when creating a new account', async () => {
    const journal = createJournal();
    const { result } = renderPresenter(journal);

    act(() => result.current.openAccountEditor());
    expect(journal.listAccountDefaults).not.toHaveBeenCalled();
    expect(result.current.accountDefaultsStatus).toBe('idle');

    act(() => {
      result.current.setAccountDraftName('New');
      result.current.setAccountDraftOpening('500');
    });
    let saved = false;
    await act(async () => {
      saved = await result.current.submitAccountDraft();
    });

    expect(saved).toBe(true);
    expect(journal.createAccount).toHaveBeenCalledWith({
      defaults: [],
      name: 'New',
      openingBalanceUsd: '500',
    });
  });

  it('keeps the editor open and returns false when a tag save is rejected', async () => {
    const journal = createJournal();
    journal.updateTag.mockResolvedValue(null);
    const { result } = renderPresenter(journal);

    act(() => result.current.openTagEditor(TEST_TAG));
    let saved = true;
    await act(async () => {
      saved = await result.current.saveTag(TEST_TAG);
    });

    expect(saved).toBe(false);
    expect(result.current.tagEditorOpen).toBe(true);
  });

  it('walks a confirmed delete one command at a time and stops on failure', async () => {
    const journal = createJournal();
    journal.deleteAccount
      .mockResolvedValueOnce(ACCOUNT)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(ACCOUNT);
    const { result } = renderPresenter(journal);

    act(() =>
      result.current.requestBulkAction('account', 'delete', [
        'account-1',
        'account-2',
        'account-3',
      ]),
    );
    expect(journal.deleteAccount).not.toHaveBeenCalled();

    await act(async () => {
      result.current.confirmPendingOperation();
    });

    expect(journal.deleteAccount.mock.calls).toEqual([['account-1'], ['account-2']]);
    expect(result.current.pendingOperation).toEqual({
      action: 'delete',
      completedCount: 1,
      entity: 'account',
      remainingIds: ['account-2', 'account-3'],
    });
    expect(result.current.bulkBusy).toBe(false);

    journal.deleteAccount.mockResolvedValue(ACCOUNT);
    await act(async () => {
      result.current.confirmPendingOperation();
    });

    expect(journal.deleteAccount.mock.calls).toEqual([
      ['account-1'],
      ['account-2'],
      ['account-2'],
      ['account-3'],
    ]);
    expect(result.current.pendingOperation).toBeNull();
  });

  it('deduplicates ids and ignores an empty request', async () => {
    const journal = createJournal();
    const { result } = renderPresenter(journal);

    act(() => result.current.requestBulkAction('asset', 'delete', []));
    expect(result.current.pendingOperation).toBeNull();

    act(() => result.current.requestBulkAction('asset', 'delete', ['asset-1', 'asset-1']));
    expect(result.current.pendingOperation?.remainingIds).toEqual(['asset-1']);
  });

  it('runs a restore immediately and exposes only a failed remainder', async () => {
    const journal = createJournal();
    journal.restoreInstrument.mockResolvedValueOnce(null);
    const { result } = renderPresenter(journal);

    await act(async () => {
      result.current.requestBulkAction('asset', 'restore', ['asset-1', 'asset-2']);
    });

    expect(journal.restoreInstrument.mock.calls).toEqual([['asset-1']]);
    expect(result.current.pendingOperation).toEqual({
      action: 'restore',
      completedCount: 0,
      entity: 'asset',
      remainingIds: ['asset-1', 'asset-2'],
    });

    journal.restoreInstrument.mockResolvedValue(EURUSD);
    await act(async () => {
      result.current.confirmPendingOperation();
    });

    expect(journal.restoreInstrument.mock.calls).toEqual([['asset-1'], ['asset-1'], ['asset-2']]);
    expect(result.current.pendingOperation).toBeNull();
  });

  it('adds only active assets that are not configured yet and removes rows', async () => {
    const journal = createJournal();
    journal.listAccountDefaults.mockResolvedValue([]);
    const { result } = renderPresenter(journal);

    act(() => result.current.openAccountEditor(ACCOUNT));
    await waitFor(() => expect(result.current.accountDefaultsStatus).toBe('ready'));

    act(() => result.current.addAccountDefault());
    act(() => result.current.addAccountDefault());
    act(() => result.current.addAccountDefault());

    expect(result.current.accountDraft.defaults).toEqual([
      { commissionUsd: '0', instrumentId: EURUSD.id, spreadTicks: '0' },
      { commissionUsd: '0', instrumentId: GBPUSD.id, spreadTicks: '0' },
    ]);

    act(() => result.current.removeAccountDefault(0));
    expect(result.current.accountDraft.defaults).toEqual([
      { commissionUsd: '0', instrumentId: GBPUSD.id, spreadTicks: '0' },
    ]);
  });
});
