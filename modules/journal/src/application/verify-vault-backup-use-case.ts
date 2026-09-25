import type { VaultBackup, VaultBackupStore } from '../contracts/vault-backup-store';

export class VerifyVaultBackupUseCase {
  public constructor(private readonly vaultBackupStore: VaultBackupStore) {}

  public execute(vaultPath: string, backupId: string): VaultBackup {
    return this.vaultBackupStore.verify(vaultPath, backupId);
  }
}
