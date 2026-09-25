import type {
  VaultBackup,
  VaultBackupKind,
  VaultBackupStore,
} from '../contracts/vault-backup-store';

export class CreateVaultBackupUseCase {
  public constructor(private readonly vaultBackupStore: VaultBackupStore) {}

  public execute(vaultPath: string, kind: VaultBackupKind): Promise<VaultBackup> {
    return this.vaultBackupStore.create(vaultPath, kind);
  }
}
