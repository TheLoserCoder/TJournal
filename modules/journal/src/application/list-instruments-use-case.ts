import type { JournalStorage } from '../contracts/journal-storage';
import type { Instrument } from '../domain/instrument';

export class ListInstrumentsUseCase {
  public constructor(private readonly journalStorage: JournalStorage) {}

  public execute(): readonly Instrument[] {
    return this.journalStorage.listInstruments();
  }
}
