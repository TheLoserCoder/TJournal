import type { InstrumentStore } from '../contracts/instrument-store';

export class ListInstrumentsUseCase {
  public constructor(private readonly instrumentStore: InstrumentStore) {}

  public execute() {
    return this.instrumentStore.listInstruments();
  }
}
