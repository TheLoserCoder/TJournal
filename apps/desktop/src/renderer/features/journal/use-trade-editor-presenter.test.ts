import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TradeDto } from '../../../shared/desktop-api';
import type { JournalPresenter } from './use-journal-presenter';
import { useTradeEditorPresenter } from './use-trade-editor-presenter';

const LEGACY_TRADE_WITHOUT_DIRECTION: TradeDto = {
  closedAt: '2026-09-13T12:00:00.000Z',
  direction: null,
  entryNote: null,
  execution: null,
  id: 'legacy-trade',
  instrumentId: 'instrument-eurusd',
  instrumentSymbol: 'EURUSD',
  resultKind: 'cash',
  resultSource: 'manual',
  resultValue: '10',
  reviewNote: null,
  reviewStatus: 'unreviewed',
  riskBindingSnapshot: null,
  tagIds: [],
};

describe('useTradeEditorPresenter', () => {
  it('loads the complete trade through the point route before editing', async () => {
    const getTrade = vi.fn().mockResolvedValue(LEGACY_TRADE_WITHOUT_DIRECTION);
    const journal = {
      getInstrumentProfile: vi.fn().mockResolvedValue(null),
      getTrade,
      instruments: [],
    } as unknown as JournalPresenter;
    const { result } = renderHook(() =>
      useTradeEditorPresenter(journal, {
        direction: 'long',
        resultKind: 'cash',
        resultValue: '',
        symbol: 'EURUSD',
      }),
    );

    await act(async () => result.current.openSavedTrade(LEGACY_TRADE_WITHOUT_DIRECTION.id));

    expect(getTrade).toHaveBeenCalledWith(LEGACY_TRADE_WITHOUT_DIRECTION.id);
    expect(result.current.editingTrade).toEqual(LEGACY_TRADE_WITHOUT_DIRECTION);
  });

  it('closes an unchanged legacy trade without submitting invalid data', async () => {
    const updateTrade = vi.fn();
    const journal = {
      getInstrumentProfile: vi.fn().mockResolvedValue(null),
      instruments: [
        {
          category: 'forex' as const,
          createdAt: '2026-09-13T12:00:00.000Z',
          id: LEGACY_TRADE_WITHOUT_DIRECTION.instrumentId,
          source: 'custom' as const,
          symbol: LEGACY_TRADE_WITHOUT_DIRECTION.instrumentSymbol,
        },
      ],
      updateTrade,
    } as unknown as JournalPresenter;

    const { result } = renderHook(() =>
      useTradeEditorPresenter(journal, {
        direction: 'long',
        resultKind: 'cash',
        resultValue: '',
        symbol: 'EURUSD',
      }),
    );

    act(() => result.current.setEditingTrade(LEGACY_TRADE_WITHOUT_DIRECTION));
    await act(async () => {
      await result.current.submitEditingTrade();
    });

    expect(updateTrade).not.toHaveBeenCalled();
    expect(result.current.editingTrade).toBeNull();
  });

  it('submits note drafts and explicit review status changes with the trade', async () => {
    const updateTrade = vi.fn().mockResolvedValue(true);
    const journal = {
      getInstrumentProfile: vi.fn().mockResolvedValue(null),
      instruments: [],
      updateTrade,
    } as unknown as JournalPresenter;
    const { result } = renderHook(() =>
      useTradeEditorPresenter(journal, {
        direction: 'long',
        resultKind: 'cash',
        resultValue: '',
        symbol: 'EURUSD',
      }),
    );

    act(() => result.current.setEditingTrade(LEGACY_TRADE_WITHOUT_DIRECTION));
    act(() => result.current.setEditingEntryNote('breakout after retest'));
    act(() => result.current.setEditingReviewNote('followed the plan'));
    act(() => result.current.setEditingReviewStatus('reviewed'));
    await act(async () => result.current.submitEditingTrade());

    expect(updateTrade).toHaveBeenCalledWith({
      ...LEGACY_TRADE_WITHOUT_DIRECTION,
      entryNote: 'breakout after retest',
      reviewNote: 'followed the plan',
      reviewStatus: 'reviewed',
    });
    expect(result.current.editingTrade).toBeNull();
  });

  it('keeps the whole draft when the create is rejected', async () => {
    const createTrade = vi.fn().mockResolvedValue(false);
    const journal = {
      accounts: [],
      createTrade,
      getInstrumentProfile: vi.fn().mockResolvedValue(null),
      instruments: [
        {
          category: 'forex' as const,
          createdAt: '2026-09-13T12:00:00.000Z',
          id: LEGACY_TRADE_WITHOUT_DIRECTION.instrumentId,
          source: 'custom' as const,
          symbol: LEGACY_TRADE_WITHOUT_DIRECTION.instrumentSymbol,
        },
      ],
    } as unknown as JournalPresenter;
    const { result } = renderHook(() =>
      useTradeEditorPresenter(journal, {
        direction: 'long',
        resultKind: 'cash',
        resultValue: '',
        symbol: 'EURUSD',
      }),
    );

    act(() => result.current.openDetails());
    act(() => result.current.setEditingResultValue('25'));
    await act(async () => result.current.submitEditingTrade());

    expect(createTrade).toHaveBeenCalledTimes(1);
    expect(result.current.editingTrade?.resultValue).toBe('25');
  });
});
