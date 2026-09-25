import type {
  GetTradePreferencesUseCase,
  ListTradesUseCase,
  RestoreTradePreferencesUseCase,
  SaveTradePreferencesUseCase,
  TradePreferences,
} from '@tjournal/trade';

import { DATA_RESOURCES } from '../../../shared/desktop-api';
import type { CommandHistory } from '../command-history';
import type { CommandOutcome } from '../command-outcome';

const TRADE_PREFERENCES_RESOURCES = [
  DATA_RESOURCES.history,
  DATA_RESOURCES.tradePreferences,
  DATA_RESOURCES.trades,
] as const;

export interface UpdateTradePreferencesCommandInput {
  readonly preferences: TradePreferences;
  readonly rebindHistorical: boolean;
}

/**
 * Undo/Redo orchestration for vault risk preferences. Historical rebinding
 * changes saved trade snapshots, so the inverse restores the previous
 * preference together with the trades it rewrote.
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
    private readonly listTradesUseCase: Pick<ListTradesUseCase, 'execute'>,
  ) {}

  public update(input: UpdateTradePreferencesCommandInput): CommandOutcome<TradePreferences> {
    const previousPreferences = this.getTradePreferencesUseCase.execute();
    const previousTrades = this.listTradesUseCase.execute();
    const value = this.history.execute({
      execute: () =>
        this.saveTradePreferencesUseCase.execute(input.preferences, input.rebindHistorical),
      label: 'trade-preferences.update',
      undo: () => {
        this.restoreTradePreferencesUseCase.execute(previousPreferences, previousTrades);
      },
    });
    return { changedResources: TRADE_PREFERENCES_RESOURCES, value };
  }
}
