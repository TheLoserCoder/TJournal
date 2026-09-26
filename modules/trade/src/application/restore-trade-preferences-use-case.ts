import type { TradeStore } from '../contracts/trade-store';
import type { TradePreferences, TradeRiskBindingSnapshot } from '../domain/trade';

export class RestoreTradePreferencesUseCase {
  public constructor(private readonly tradeStore: TradeStore) {}
  public execute(
    preferences: TradePreferences,
    reboundRiskBindings: readonly TradeRiskBindingSnapshot[],
  ): void {
    this.tradeStore.restoreTradePreferences(preferences, reboundRiskBindings);
  }
}
