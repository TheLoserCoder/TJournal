import type { TradeStore } from '../contracts/trade-store';
import type { ClosedTrade } from '../domain/trade';

export class ListTradesUseCase {
  public constructor(private readonly tradeStore: TradeStore) {}
  public execute(): readonly ClosedTrade[] {
    return this.tradeStore.listTrades();
  }
}
