import type { InstrumentStore } from '../contracts/instrument-store';

export class ArchiveInstrumentUseCase {
  public constructor(private readonly instrumentStore: InstrumentStore) {}

  public execute(id: string) {
    return this.instrumentStore.archiveInstrument(id);
  }
}
