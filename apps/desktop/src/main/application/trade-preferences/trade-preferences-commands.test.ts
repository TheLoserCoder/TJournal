import { describe, expect, it, vi } from 'vitest';

import type { ClosedTrade, TradePreferences } from '@tjournal/trade';

import { DATA_RESOURCES } from '../../../shared/desktop-api';
import { UndoRedoHistory } from '../../history/undo-redo-history';
import { TradePreferencesCommands } from './trade-preferences-commands';

const makePreferences = (overrides: Partial<TradePreferences> = {}): TradePreferences => ({
  neutralCostSettings: { includeCommission: true, includeSpread: false },
  neutralRanges: { cash: null, percent: null, r: null },
  riskBinding: { kind: 'cash', value: '100' },
  riskPromptDismissed: false,
  ...overrides,
});

const makeTrade = (id: string): ClosedTrade => ({
  account: null,
  closedAt: '2026-01-01T00:00:00.000Z',
  direction: 'long',
  entryNote: null,
  execution: null,
  id,
  instrumentId: 'instrument-1',
  instrumentSymbol: 'ES',
  netResultUsd: '100',
  resultKind: 'cash',
  resultSource: 'manual',
  resultValue: '100',
  reviewNote: null,
  reviewStatus: 'unreviewed',
  riskBindingSnapshot: null,
  tagIds: [],
});

const createHarness = () => {
  const history = new UndoRedoHistory();
  const getTradePreferencesUseCase = {
    execute: vi.fn((): TradePreferences => makePreferences()),
  };
  const saveTradePreferencesUseCase = {
    execute: vi.fn(
      (preferences: TradePreferences, _rebindHistorical = false): TradePreferences => preferences,
    ),
  };
  const restoreTradePreferencesUseCase = { execute: vi.fn() };
  const listTradesUseCase = {
    execute: vi.fn((): readonly ClosedTrade[] => [makeTrade('trade-1')]),
  };
  const commands = new TradePreferencesCommands(
    history,
    getTradePreferencesUseCase,
    saveTradePreferencesUseCase,
    restoreTradePreferencesUseCase,
    listTradesUseCase,
  );
  return {
    commands,
    getTradePreferencesUseCase,
    history,
    listTradesUseCase,
    restoreTradePreferencesUseCase,
    saveTradePreferencesUseCase,
  };
};

describe('TradePreferencesCommands', () => {
  it('saves preferences with the rebind flag and invalidates preferences and trades', () => {
    const { commands, history, saveTradePreferencesUseCase } = createHarness();
    const preferences = makePreferences({ riskPromptDismissed: true });

    const outcome = commands.update({ preferences, rebindHistorical: true });

    expect(saveTradePreferencesUseCase.execute).toHaveBeenCalledWith(preferences, true);
    expect(outcome.value).toBe(preferences);
    expect(outcome.changedResources).toEqual([
      DATA_RESOURCES.history,
      DATA_RESOURCES.tradePreferences,
      DATA_RESOURCES.trades,
    ]);
    expect(history.getState().canUndo).toBe(true);
  });

  it('restores the previous preferences and the trades they rewrote on undo', () => {
    const { commands, history, listTradesUseCase, restoreTradePreferencesUseCase } =
      createHarness();

    commands.update({
      preferences: makePreferences({ riskPromptDismissed: true }),
      rebindHistorical: true,
    });
    history.undo();

    expect(listTradesUseCase.execute).toHaveBeenCalledTimes(1);
    expect(restoreTradePreferencesUseCase.execute).toHaveBeenCalledWith(makePreferences(), [
      makeTrade('trade-1'),
    ]);
  });

  it('does not record a failed save in history', () => {
    const { commands, history, saveTradePreferencesUseCase } = createHarness();
    saveTradePreferencesUseCase.execute.mockImplementation(() => {
      throw new Error('invalid preferences');
    });

    expect(() =>
      commands.update({ preferences: makePreferences(), rebindHistorical: false }),
    ).toThrow('invalid preferences');
    expect(history.getState().canUndo).toBe(false);
  });
});
