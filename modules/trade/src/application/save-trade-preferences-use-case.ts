import type { TradeStore } from '../contracts/trade-store';
import type { TradePreferences } from '../domain/trade';
import { validateTradePreferences } from '../domain/trade-validation';

export class SaveTradePreferencesUseCase {
  public constructor(private readonly tradeStore: TradeStore) {}
  public execute(preferences: TradePreferences, rebindHistorical = false): TradePreferences {
    validateTradePreferences(preferences);
    return this.tradeStore.saveTradePreferences(preferences, rebindHistorical);
  }
}
