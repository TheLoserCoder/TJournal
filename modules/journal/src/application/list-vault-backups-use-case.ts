import type { VaultBackupPage, VaultBackupStore } from '../contracts/vault-backup-store';

export class ListVaultBackupsUseCase {
  public constructor(private readonly vaultBackupStore: VaultBackupStore) {}

  public execute(vaultPath: string, beforeId?: string | null): VaultBackupPage {
    return this.vaultBackupStore.list(vaultPath, beforeId);
  }
}
