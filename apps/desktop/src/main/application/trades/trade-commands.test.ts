import { describe, expect, it, vi } from 'vitest';

import type { ClosedTrade, CreateClosedTradeInput } from '@tjournal/trade';

import { DATA_RESOURCES } from '../../../shared/desktop-api';
import { UndoRedoHistory } from '../../history/undo-redo-history';
import { TradeCommands } from './trade-commands';

const makeTrade = (overrides: Partial<ClosedTrade> = {}): ClosedTrade => ({
  account: null,
  closedAt: '2026-01-01T00:00:00.000Z',
  direction: 'long',
  execution: null,
  id: 'trade-1',
  instrumentId: 'instrument-1',
  instrumentSymbol: 'ES',
  netResultUsd: '100',
  resultKind: 'cash',
  resultSource: 'manual',
  resultValue: '100',
  riskBindingSnapshot: null,
  tagIds: ['tag-1'],
  ...overrides,
  entryNote: overrides.entryNote ?? null,
  reviewNote: overrides.reviewNote ?? null,
  reviewStatus: overrides.reviewStatus ?? 'unreviewed',
});

const createHarness = () => {
  const history = new UndoRedoHistory();
  const createTradeUseCase = {
    execute: vi.fn((input: CreateClosedTradeInput, id = 'trade-created'): ClosedTrade =>
      makeTrade({ id, instrumentId: input.instrumentId }),
    ),
  };
  const updateTradeUseCase = {
    execute: vi.fn((input: ClosedTrade): ClosedTrade => input),
  };
  const getTradeByIdUseCase = {
    execute: vi.fn((id: string): ClosedTrade | null => (id === 'trade-1' ? makeTrade() : null)),
  };
  const deleteTradeUseCase = {
    execute: vi.fn((id: string): ClosedTrade => makeTrade({ id })),
  };
  const deleteTradesUseCase = {
    execute: vi.fn((ids: readonly string[]): readonly ClosedTrade[] =>
      ids.map((id) => makeTrade({ id })),
    ),
  };
  const restoreTradeUseCase = { execute: vi.fn() };
  const restoreTradesUseCase = { execute: vi.fn() };
  const commands = new TradeCommands(
    history,
    createTradeUseCase,
    updateTradeUseCase,
    getTradeByIdUseCase,
    deleteTradeUseCase,
    deleteTradesUseCase,
    restoreTradeUseCase,
    restoreTradesUseCase,
  );
  return {
    commands,
    createTradeUseCase,
    deleteTradeUseCase,
    deleteTradesUseCase,
    getTradeByIdUseCase,
    history,
    restoreTradeUseCase,
    restoreTradesUseCase,
    updateTradeUseCase,
  };
};

const createInput: CreateClosedTradeInput = {
  accountId: 'account-1',
  closedAt: '2026-01-01T00:00:00.000Z',
  direction: 'long',
  execution: null,
  instrumentId: 'instrument-1',
  resultKind: 'cash',
  resultValue: '100',
};

describe('TradeCommands', () => {
  it('creates a trade and undoes it by deleting the same id', () => {
    const { commands, createTradeUseCase, deleteTradeUseCase, history } = createHarness();

    const outcome = commands.create(createInput);

    expect(outcome.value.id).toBe('trade-created');
    expect(outcome.changedResources).toEqual([DATA_RESOURCES.history, DATA_RESOURCES.trades]);
    expect(createTradeUseCase.execute).toHaveBeenCalledWith(createInput, undefined);

    history.undo();
    expect(deleteTradeUseCase.execute).toHaveBeenCalledWith('trade-created');
  });

  it('recreates a trade with its original id on redo', () => {
    const { commands, createTradeUseCase, history } = createHarness();

    commands.create(createInput);
    history.undo();
    history.redo();

    expect(createTradeUseCase.execute).toHaveBeenCalledTimes(2);
    expect(createTradeUseCase.execute.mock.calls[1]?.[1]).toBe('trade-created');
  });

  it('restores the whole previous aggregate when an update is undone', () => {
    const { commands, getTradeByIdUseCase, history, restoreTradeUseCase, updateTradeUseCase } =
      createHarness();
    const previous = makeTrade({
      entryNote: 'original reason',
      reviewNote: 'original review',
      reviewStatus: 'unreviewed',
    });
    const input = makeTrade({
      entryNote: 'revised reason',
      resultValue: '250',
      reviewNote: 'review completed',
      reviewStatus: 'reviewed',
    });
    getTradeByIdUseCase.execute.mockReturnValue(previous);

    commands.update(input);
    expect(updateTradeUseCase.execute).toHaveBeenCalledWith(input);

    history.undo();
    expect(restoreTradeUseCase.execute).toHaveBeenCalledWith(previous);

    history.redo();
    expect(updateTradeUseCase.execute).toHaveBeenLastCalledWith(input);
  });

  it('restores a deleted trade from its snapshot on undo', () => {
    const { commands, history, restoreTradesUseCase } = createHarness();

    commands.delete('trade-1');
    expect(restoreTradesUseCase.execute).not.toHaveBeenCalled();

    history.undo();
    expect(restoreTradesUseCase.execute).toHaveBeenCalledWith([makeTrade()]);
  });

  it('restores every deleted trade in one undo', () => {
    const { commands, history, restoreTradesUseCase } = createHarness();

    const outcome = commands.deleteMany(['trade-1', 'trade-2']);

    expect(outcome.value.map((trade) => trade.id)).toEqual(['trade-1', 'trade-2']);
    expect(outcome.changedResources).toEqual([DATA_RESOURCES.history]);

    history.undo();
    expect(restoreTradesUseCase.execute).toHaveBeenCalledWith([
      makeTrade({ id: 'trade-1' }),
      makeTrade({ id: 'trade-2' }),
    ]);
  });

  it('refuses to delete an unknown trade without touching history', () => {
    const { commands, deleteTradeUseCase, history } = createHarness();

    expect(() => commands.delete('missing')).toThrow('Trade not found.');
    expect(deleteTradeUseCase.execute).not.toHaveBeenCalled();
    expect(history.getState().canUndo).toBe(false);
  });
});
