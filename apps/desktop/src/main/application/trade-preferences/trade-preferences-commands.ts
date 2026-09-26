import type {
  GetTradePreferencesUseCase,
  RestoreTradePreferencesUseCase,
  SaveTradePreferencesUseCase,
  TradePreferences,
  TradeRiskBindingSnapshot,
} from '@tjournal/trade';

import { DATA_RESOURCES } from '../../../shared/desktop-api';
import type { CommandHistory } from '../command-history';
import type { CommandOutcome } from '../command-outcome';

const PREFERENCE_RESOURCES = [DATA_RESOURCES.history, DATA_RESOURCES.tradePreferences] as const;
const REBOUND_RESOURCES = [...PREFERENCE_RESOURCES, DATA_RESOURCES.trades] as const;

export interface UpdateTradePreferencesCommandInput {
  readonly preferences: TradePreferences;
  readonly rebindHistorical: boolean;
}

/**
 * Undo/Redo orchestration for vault risk preferences. A historical rebind
 * rewrites saved trade snapshots, so its inverse restores the exact bindings it
 * changed; a preference-only change keeps the inverse to the preference row and
 * does not invalidate trade-derived views.
 */
export class TradePreferencesCommands {
  public constructor(
    private readonly history: CommandHistory,
    private readonly getTradePreferencesUseCase: Pick<GetTradePreferencesUseCase, 'execute'>,
    private readonly saveTradePreferencesUseCase: Pick<SaveTradePreferencesUseCase, 'execute'>,
    private readonly restoreTradePreferencesUseCase: Pick<
      RestoreTradePreferencesUseCase,
      'execute'
    >,
  ) {}

  public update(input: UpdateTradePreferencesCommandInput): CommandOutcome<TradePreferences> {
    const previousPreferences = this.getTradePreferencesUseCase.execute();
    let reboundRiskBindings: readonly TradeRiskBindingSnapshot[] = [];
    const value = this.history.execute({
      execute: () => {
        const saved = this.saveTradePreferencesUseCase.execute(
          input.preferences,
          input.rebindHistorical,
        );
        reboundRiskBindings = saved.reboundRiskBindings;
        return saved.preferences;
      },
      label: 'trade-preferences.update',
      undo: () => {
        this.restoreTradePreferencesUseCase.execute(previousPreferences, reboundRiskBindings);
      },
    });
    return {
      changedResources: reboundRiskBindings.length === 0 ? PREFERENCE_RESOURCES : REBOUND_RESOURCES,
      value,
    };
  }
}
