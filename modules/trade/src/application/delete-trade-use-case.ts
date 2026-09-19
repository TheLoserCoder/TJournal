import type { TradeStore } from '../contracts/trade-store';
import type { ClosedTrade } from '../domain/trade';

export class DeleteTradeUseCase {
  public constructor(private readonly tradeStore: TradeStore) {}
  public execute(id: string): ClosedTrade {
    return this.tradeStore.deleteTrade(id);
  }
}
