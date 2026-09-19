import type { InstrumentStore } from '../contracts/instrument-store';
import {
  normalizeCalculationProfile,
  normalizeInstrumentSymbol,
  type UpdateInstrumentInput,
} from '../domain/instrument';

export class UpdateInstrumentUseCase {
  public constructor(private readonly instrumentStore: InstrumentStore) {}

  public execute(input: UpdateInstrumentInput) {
    return this.instrumentStore.updateInstrument({
      ...input,
      symbol: normalizeInstrumentSymbol(input.symbol),
      calculationProfile: normalizeCalculationProfile(input.calculationProfile),
    });
  }
}
