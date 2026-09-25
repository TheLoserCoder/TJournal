import type { InstrumentStore } from '../contracts/instrument-store';
import type { InstrumentCalculationProfile } from '../domain/instrument';

export class GetInstrumentProfileUseCase {
  public constructor(
    private readonly instrumentStore: Pick<InstrumentStore, 'getInstrumentProfile'>,
  ) {}

  public execute(instrumentId: string): InstrumentCalculationProfile | null {
    return this.instrumentStore.getInstrumentProfile(instrumentId);
  }
}
