import type { JournalStorage } from '../contracts/journal-storage';
import type { VaultDescriptor } from '../domain/vault';

export class InspectVaultUseCase {
  public constructor(private readonly journalStorage: JournalStorage) {}

  public execute(vaultPath: string): VaultDescriptor {
    return this.journalStorage.inspectVault(vaultPath);
  }
}
