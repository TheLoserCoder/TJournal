import type { JournalStorage } from '../contracts/journal-storage';
import type { CreateVaultBackupUseCase } from './create-vault-backup-use-case';
import type { VaultDescriptor } from '../domain/vault';

export class OpenVaultUseCase {
  public constructor(
    private readonly journalStorage: JournalStorage,
    private readonly createVaultBackupUseCase: CreateVaultBackupUseCase,
  ) {}

  public async execute(vaultPath: string): Promise<VaultDescriptor> {
    if (this.journalStorage.pendingMigrations(vaultPath).length > 0) {
      await this.createVaultBackupUseCase.execute(vaultPath, 'automatic');
    }
    return this.journalStorage.openVault(vaultPath);
  }
}
