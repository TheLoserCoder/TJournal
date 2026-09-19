import type { InstrumentStore } from '../contracts/instrument-store';

export class DeleteInstrumentUseCase {
  public constructor(private readonly instrumentStore: InstrumentStore) {}

  public execute(id: string) {
    return this.instrumentStore.deleteInstrument(id);
  }
}
