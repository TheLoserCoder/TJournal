import type { VaultBackupStore } from '../contracts/vault-backup-store';

export class RestoreVaultBackupUseCase {
  public constructor(private readonly vaultBackupStore: VaultBackupStore) {}

  public execute(vaultPath: string, backupId: string, destinationPath: string): Promise<string> {
    return this.vaultBackupStore.restore(vaultPath, backupId, destinationPath);
  }
}
