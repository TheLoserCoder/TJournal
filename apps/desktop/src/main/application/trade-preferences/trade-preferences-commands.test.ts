import { describe, expect, it, vi } from 'vitest';

import type {
  SavedTradePreferences,
  TradePreferences,
  TradeRiskBindingSnapshot,
} from '@tjournal/trade';

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

const REBOUND: readonly TradeRiskBindingSnapshot[] = [
  {
    riskBindingSnapshot: { kind: 'cash', source: 'vault-default', value: '100' },
    tradeId: 'trade-1',
  },
];

const createHarness = (reboundRiskBindings: readonly TradeRiskBindingSnapshot[] = []) => {
  const history = new UndoRedoHistory();
  const getTradePreferencesUseCase = {
    execute: vi.fn((): TradePreferences => makePreferences()),
  };
  const saveTradePreferencesUseCase = {
    execute: vi.fn(
      (preferences: TradePreferences, _rebindHistorical = false): SavedTradePreferences => ({
        preferences,
        reboundRiskBindings,
      }),
    ),
  };
  const restoreTradePreferencesUseCase = { execute: vi.fn() };
  const commands = new TradePreferencesCommands(
    history,
    getTradePreferencesUseCase,
    saveTradePreferencesUseCase,
    restoreTradePreferencesUseCase,
  );
  return {
    commands,
    getTradePreferencesUseCase,
    history,
    restoreTradePreferencesUseCase,
    saveTradePreferencesUseCase,
  };
};

describe('TradePreferencesCommands', () => {
  it('saves preferences with the rebind flag and invalidates preferences and trades', () => {
    const { commands, history, saveTradePreferencesUseCase } = createHarness(REBOUND);
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

  it('omits the trade invalidation when no trade binding was rewritten', () => {
    const { commands } = createHarness([]);

    const outcome = commands.update({ preferences: makePreferences(), rebindHistorical: false });

    expect(outcome.changedResources).toEqual([
      DATA_RESOURCES.history,
      DATA_RESOURCES.tradePreferences,
    ]);
  });

  it('restores the previous preferences and the rewritten bindings on undo', () => {
    const { commands, history, restoreTradePreferencesUseCase } = createHarness(REBOUND);

    commands.update({
      preferences: makePreferences({ riskPromptDismissed: true }),
      rebindHistorical: true,
    });
    history.undo();

    expect(restoreTradePreferencesUseCase.execute).toHaveBeenCalledWith(makePreferences(), REBOUND);
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
