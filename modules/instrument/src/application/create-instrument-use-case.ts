import { randomUUID } from 'node:crypto';
import type { InstrumentStore } from '../contracts/instrument-store';
import {
  normalizeCalculationProfile,
  normalizeInstrumentSymbol,
  type CreateInstrumentInput,
} from '../domain/instrument';

export class CreateInstrumentUseCase {
  public constructor(private readonly instrumentStore: InstrumentStore) {}

  public execute(input: CreateInstrumentInput, id: string = randomUUID()) {
    return this.instrumentStore.createInstrument({
      ...input,
      id,
      symbol: normalizeInstrumentSymbol(input.symbol),
      calculationProfile: normalizeCalculationProfile(input.calculationProfile),
    });
  }
}
