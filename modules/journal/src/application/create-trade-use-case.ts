import { randomUUID } from 'node:crypto';

import { normalizeDecimal } from '@tjournal/platform-numeric';

import type { JournalStorage } from '../contracts/journal-storage';
import type { ClosedTrade, CreateClosedTradeInput } from '../domain/closed-trade';

export class CreateTradeUseCase {
  public constructor(private readonly journalStorage: JournalStorage) {}

  public execute(input: CreateClosedTradeInput, id: string = randomUUID()): ClosedTrade {
    return this.journalStorage.createTrade({
      ...input,
      id,
      resultValue: normalizeDecimal(input.resultValue),
    });
  }
}
