import type { TradeStore } from '../contracts/trade-store';
import type { ClosedTrade, TradePreferences } from '../domain/trade';

export class RestoreTradePreferencesUseCase {
  public constructor(private readonly tradeStore: TradeStore) {}
  public execute(preferences: TradePreferences, trades: readonly ClosedTrade[]): void {
    this.tradeStore.restoreTradePreferences(preferences, trades);
  }
}
