import type { TradeStore } from '../contracts/trade-store';
import type { ClosedTrade } from '../domain/trade';

export class RestoreTradeUseCase {
  public constructor(private readonly tradeStore: TradeStore) {}
  public execute(trade: ClosedTrade): ClosedTrade {
    return this.tradeStore.updateTrade(trade);
  }
}
