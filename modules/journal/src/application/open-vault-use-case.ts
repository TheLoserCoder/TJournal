import type { JournalStorage } from '../contracts/journal-storage';
import type { VaultDescriptor } from '../domain/vault';

export class OpenVaultUseCase {
  public constructor(private readonly journalStorage: JournalStorage) {}

  public execute(vaultPath: string): VaultDescriptor {
    return this.journalStorage.openVault(vaultPath);
  }
}
