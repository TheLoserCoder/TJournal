import type { TradeStore } from '../contracts/trade-store';
import type { InstrumentCalculationProfile } from '../domain/trade';

export class GetInstrumentProfileUseCase {
  public constructor(private readonly tradeStore: TradeStore) {}
  public execute(instrumentId: string): InstrumentCalculationProfile | null {
    return this.tradeStore.getInstrumentProfile(instrumentId);
  }
}
