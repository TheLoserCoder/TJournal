import type { InstrumentStore } from '../contracts/instrument-store';

export class RestoreInstrumentUseCase {
  public constructor(private readonly instrumentStore: InstrumentStore) {}

  public execute(id: string) {
    return this.instrumentStore.restoreArchivedInstrument(id);
  }
}
