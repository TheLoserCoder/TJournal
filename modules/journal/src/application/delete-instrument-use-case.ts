import type { JournalStorage } from '../contracts/journal-storage';
import type { Instrument } from '../domain/instrument';

export class DeleteInstrumentUseCase {
  public constructor(private readonly journalStorage: JournalStorage) {}

  public execute(id: string): Instrument {
    return this.journalStorage.deleteInstrument(id);
  }
}
