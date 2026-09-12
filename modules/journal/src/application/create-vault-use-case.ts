import type { JournalStorage } from '../contracts/journal-storage';
import type { VaultDescriptor } from '../domain/vault';

export class CreateVaultUseCase {
  public constructor(private readonly journalStorage: JournalStorage) {}

  public execute(vaultPath: string): VaultDescriptor {
    return this.journalStorage.createVault(vaultPath);
  }
}
