import type { JournalStorage } from '../contracts/journal-storage';
import type { ClosedTrade } from '../domain/closed-trade';

export class ListTradesUseCase {
  public constructor(private readonly journalStorage: JournalStorage) {}

  public execute(): readonly ClosedTrade[] {
    return this.journalStorage.listTrades();
  }
}
