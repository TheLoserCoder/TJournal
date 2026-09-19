import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TradeDto } from '../../../shared/desktop-api';
import type { JournalPresenter } from './use-journal-presenter';
import { useTradeEditorPresenter } from './use-trade-editor-presenter';

const LEGACY_TRADE_WITHOUT_DIRECTION: TradeDto = {
  closedAt: '2026-09-13T12:00:00.000Z',
  direction: null,
  execution: null,
  id: 'legacy-trade',
  instrumentId: 'instrument-eurusd',
  instrumentSymbol: 'EURUSD',
  resultKind: 'cash',
  resultSource: 'manual',
  resultValue: '10',
  riskBindingSnapshot: null,
};

describe('useTradeEditorPresenter', () => {
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
});
