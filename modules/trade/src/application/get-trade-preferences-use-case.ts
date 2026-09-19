import type { TradeStore } from '../contracts/trade-store';
import type { TradePreferences } from '../domain/trade';

export class GetTradePreferencesUseCase {
  public constructor(private readonly tradeStore: TradeStore) {}
  public execute(): TradePreferences {
    return this.tradeStore.getTradePreferences();
  }
}
