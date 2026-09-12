import type { JournalStorage } from '../contracts/journal-storage';

export class CheckVaultIntegrityUseCase {
  public constructor(private readonly journalStorage: JournalStorage) {}

  public execute(): void {
    this.journalStorage.checkIntegrity();
  }
}
