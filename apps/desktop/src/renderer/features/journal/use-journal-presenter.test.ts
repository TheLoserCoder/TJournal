import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DATA_RESOURCES,
  type CommittedDataChangeDto,
  type DataResource,
} from '../../../shared/desktop-api';
import { DEFAULT_APPLICATION_SETTINGS } from '../../../shared/application-settings';

import {
  createRendererGatewayStub,
  type RendererGatewayStub,
} from './testing/renderer-gateway-stub';
import { useJournalPresenter } from './use-journal-presenter';

const change = (
  resources: readonly DataResource[],
  vaultGeneration = 'generation-1',
): CommittedDataChangeDto => ({
  changeId: `change-${Math.random().toString(36).slice(2)}`,
  resources,
  revisions: {},
  vaultGeneration,
});

const mountPresenter = (stub: RendererGatewayStub) => {
  const { result, unmount } = renderHook(() => useJournalPresenter(stub.gateway));
  return { result, unmount };
};

const waitForInitialLoad = async (stub: RendererGatewayStub): Promise<void> => {
  await waitFor(() => expect(vi.mocked(stub.gateway.listAccounts)).toHaveBeenCalledTimes(1));
  expect(vi.mocked(stub.gateway.listInstruments)).toHaveBeenCalledTimes(1);
  expect(vi.mocked(stub.gateway.listTags)).toHaveBeenCalledTimes(1);
  expect(vi.mocked(stub.gateway.getTagTradeCounts)).toHaveBeenCalledTimes(1);
  expect(vi.mocked(stub.gateway.getHistory)).toHaveBeenCalledTimes(1);
  expect(vi.mocked(stub.gateway.getSettings)).toHaveBeenCalledTimes(1);
  expect(vi.mocked(stub.gateway.getTradePreferences)).toHaveBeenCalledTimes(1);
};

const clearGatewayMocks = (stub: RendererGatewayStub): void => {
  vi.mocked(stub.gateway.listAccounts).mockClear();
  vi.mocked(stub.gateway.listCashMovements).mockClear();
  vi.mocked(stub.gateway.listInstruments).mockClear();
  vi.mocked(stub.gateway.listTags).mockClear();
  vi.mocked(stub.gateway.getTagTradeCounts).mockClear();
  vi.mocked(stub.gateway.getHistory).mockClear();
  vi.mocked(stub.gateway.getSettings).mockClear();
  vi.mocked(stub.gateway.getTradePreferences).mockClear();
};

describe('useJournalPresenter refresh policy', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('refreshes only the groups affected by a committed change', async () => {
    const stub = createRendererGatewayStub();
    mountPresenter(stub);
    await waitForInitialLoad(stub);
    clearGatewayMocks(stub);

    act(() => stub.changes.emit(change([DATA_RESOURCES.trades])));

    await waitFor(() => expect(vi.mocked(stub.gateway.listAccounts)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(stub.gateway.listCashMovements)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(stub.gateway.listInstruments)).not.toHaveBeenCalled();
    expect(vi.mocked(stub.gateway.getHistory)).not.toHaveBeenCalled();
    expect(vi.mocked(stub.gateway.listTags)).not.toHaveBeenCalled();
  });

  it('refreshes tag counts when assignments change', async () => {
    const stub = createRendererGatewayStub();
    mountPresenter(stub);
    await waitForInitialLoad(stub);
    clearGatewayMocks(stub);

    act(() => stub.changes.emit(change([DATA_RESOURCES.tradeTags])));

    await waitFor(() => expect(vi.mocked(stub.gateway.listTags)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(stub.gateway.getTagTradeCounts)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(stub.gateway.listAccounts)).not.toHaveBeenCalled();
  });

  it('performs a full refresh when the vault generation changes', async () => {
    const stub = createRendererGatewayStub();
    mountPresenter(stub);
    await waitForInitialLoad(stub);
    // The first event after activation establishes the current generation.
    act(() => stub.changes.emit(change([DATA_RESOURCES.accounts], 'generation-1')));
    await waitFor(() => expect(vi.mocked(stub.gateway.listAccounts)).toHaveBeenCalledTimes(1));
    clearGatewayMocks(stub);

    act(() => stub.changes.emit(change([], 'generation-2')));

    await waitFor(() => expect(vi.mocked(stub.gateway.listAccounts)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(stub.gateway.listInstruments)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(stub.gateway.listTags)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(stub.gateway.getTagTradeCounts)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(stub.gateway.getHistory)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(stub.gateway.getSettings)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(stub.gateway.getTradePreferences)).toHaveBeenCalledTimes(1);
  });

  it('does not duplicate an event-driven refresh after an explicit mutation', async () => {
    const stub = createRendererGatewayStub();
    const { result } = mountPresenter(stub);
    await waitForInitialLoad(stub);
    clearGatewayMocks(stub);

    vi.mocked(stub.gateway.undo).mockImplementation(async () => {
      stub.changes.emit(change([DATA_RESOURCES.history, DATA_RESOURCES.tradeTags]));
      return {
        ok: true,
        value: { canRedo: false, canUndo: false, redoLabel: null, undoLabel: null },
      };
    });

    await act(async () => {
      await result.current.undo();
    });

    await waitFor(() => expect(vi.mocked(stub.gateway.getHistory)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(stub.gateway.listTags)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(stub.gateway.listAccounts)).not.toHaveBeenCalled();
  });

  it('falls back to a full refresh when a successful mutation publishes no event', async () => {
    const stub = createRendererGatewayStub();
    const { result } = mountPresenter(stub);
    await waitForInitialLoad(stub);
    clearGatewayMocks(stub);

    await act(async () => {
      await result.current.undo();
    });

    expect(vi.mocked(stub.gateway.listAccounts)).not.toHaveBeenCalled();
    await waitFor(() => expect(vi.mocked(stub.gateway.listAccounts)).toHaveBeenCalledTimes(1), {
      timeout: 3000,
    });
    expect(vi.mocked(stub.gateway.listInstruments)).toHaveBeenCalledTimes(1);
  });
});

describe('useJournalPresenter settings', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  /** Persists settings on the double so `getSettings` stays the acknowledged source. */
  const storeSettings = (stub: RendererGatewayStub): void => {
    let stored = DEFAULT_APPLICATION_SETTINGS;
    vi.mocked(stub.gateway.getSettings).mockImplementation(async () => ({
      ok: true,
      value: stored,
    }));
    vi.mocked(stub.gateway.updateSettings).mockImplementation(async (input) => {
      stored = input;
      return { ok: true, value: input };
    });
  };

  it('applies a settings patch from the acknowledged response without a settings event', async () => {
    const stub = createRendererGatewayStub();
    storeSettings(stub);
    const { result } = mountPresenter(stub);
    await waitForInitialLoad(stub);

    await act(async () => {
      await result.current.updateSettings({ themeMode: 'dark' });
    });

    expect(vi.mocked(stub.gateway.updateSettings)).toHaveBeenCalledWith(
      expect.objectContaining({ themeMode: 'dark' }),
    );
    // No `application-settings` event is emitted, so this can only pass when the
    // presenter trusts its own acknowledged response.
    expect(result.current.settings.themeMode).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('composes two patches applied in quick succession', async () => {
    const stub = createRendererGatewayStub();
    storeSettings(stub);
    const { result } = mountPresenter(stub);
    await waitForInitialLoad(stub);

    await act(async () => {
      const theme = result.current.updateSettings({ themeMode: 'dark' });
      const language = result.current.updateSettings({ languageMode: 'ru' });
      await Promise.all([theme, language]);
    });

    // The second write merges over the first optimistic value instead of
    // overwriting it with a stale snapshot that still had `themeMode: 'auto'`.
    expect(vi.mocked(stub.gateway.updateSettings)).toHaveBeenLastCalledWith(
      expect.objectContaining({ languageMode: 'ru', themeMode: 'dark' }),
    );
    expect(result.current.settings.themeMode).toBe('dark');
    expect(result.current.settings.languageMode).toBe('ru');
  });

  it('restores the acknowledged settings when a settings write fails', async () => {
    const stub = createRendererGatewayStub();
    storeSettings(stub);
    const { result } = mountPresenter(stub);
    await waitForInitialLoad(stub);
    vi.mocked(stub.gateway.updateSettings).mockResolvedValue({
      error: { code: 'unexpected', retryable: false },
      ok: false,
    });

    await act(async () => {
      await result.current.updateSettings({ themeMode: 'dark' });
    });

    expect(result.current.settings.themeMode).toBe('auto');
    expect(result.current.error?.code).toBe('unexpected');
  });

  it('follows the operating-system theme while the mode is auto', async () => {
    const listeners = new Set<() => void>();
    let prefersDark = false;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
        get matches() {
          return prefersDark;
        },
        removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
      })),
    });
    const stub = createRendererGatewayStub();
    storeSettings(stub);
    mountPresenter(stub);
    await waitForInitialLoad(stub);
    expect(document.documentElement.dataset.theme).toBe('light');

    prefersDark = true;
    act(() => {
      listeners.forEach((listener) => listener());
    });

    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
