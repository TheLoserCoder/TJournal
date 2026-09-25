import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DATA_RESOURCES,
  type CommittedDataChangeDto,
  type DataResource,
} from '../../../shared/desktop-api';

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
