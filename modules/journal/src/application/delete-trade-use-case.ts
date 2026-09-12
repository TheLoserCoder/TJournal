import type { JournalStorage } from '../contracts/journal-storage';
import type { ClosedTrade } from '../domain/closed-trade';

export class DeleteTradeUseCase {
  public constructor(private readonly journalStorage: JournalStorage) {}

  public execute(id: string): ClosedTrade {
    return this.journalStorage.deleteTrade(id);
  }
}
