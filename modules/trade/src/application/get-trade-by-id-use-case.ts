import type { TradeStore } from '../contracts/trade-store';
import type { ClosedTrade } from '../domain/trade';

/** Point lookup for a single trade without loading the whole journal. */
export class GetTradeByIdUseCase {
  public constructor(private readonly tradeStore: TradeStore) {}

  public execute(id: string): ClosedTrade | null {
    return this.tradeStore.getTradeById(id);
  }
}
