import { randomUUID } from 'node:crypto';

import type { JournalStorage } from '../contracts/journal-storage';
import {
  normalizeInstrumentSymbol,
  type CreateInstrumentInput,
  type Instrument,
} from '../domain/instrument';

export class CreateInstrumentUseCase {
  public constructor(private readonly journalStorage: JournalStorage) {}

  public execute(input: CreateInstrumentInput, id: string = randomUUID()): Instrument {
    return this.journalStorage.createInstrument({
      ...input,
      id,
      symbol: normalizeInstrumentSymbol(input.symbol),
    });
  }
}
