import type { JournalStorage } from '../contracts/journal-storage';

export class CloseVaultUseCase {
  public constructor(private readonly journalStorage: JournalStorage) {}

  public execute(): void {
    this.journalStorage.close();
  }
}
