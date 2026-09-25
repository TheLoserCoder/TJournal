import type { InstrumentStore } from '../contracts/instrument-store';
import type { Instrument } from '../domain/instrument';

/** Point lookup for a single instrument without loading the catalog. */
export class GetInstrumentByIdUseCase {
  public constructor(private readonly instrumentStore: InstrumentStore) {}

  public execute(id: string): Instrument | null {
    return this.instrumentStore.getInstrumentById(id);
  }
}
