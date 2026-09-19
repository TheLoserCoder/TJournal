import type { TradeStore } from '../contracts/trade-store';
import type { ClosedTrade } from '../domain/trade';

export class RestoreTradesUseCase {
  public constructor(private readonly tradeStore: TradeStore) {}
  public execute(trades: readonly ClosedTrade[]): void {
    this.tradeStore.restoreTrades(trades);
  }
}
