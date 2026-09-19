import type { TradeStore } from '../contracts/trade-store';
import type { ClosedTrade } from '../domain/trade';

export class DeleteTradesUseCase {
  public constructor(private readonly tradeStore: TradeStore) {}
  public execute(ids: readonly string[]): readonly ClosedTrade[] {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0 || uniqueIds.length !== ids.length)
      throw new Error('Invalid trade identifiers.');
    return this.tradeStore.deleteTrades(uniqueIds);
  }
}
