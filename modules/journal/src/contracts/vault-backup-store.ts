export type VaultBackupKind = 'automatic' | 'manual';

export interface VaultBackup {
  readonly id: string;
  readonly kind: VaultBackupKind;
  readonly createdAt: string;
  readonly sourceVaultId: string;
  readonly databaseBytes: number;
}

export interface VaultBackupPage {
  readonly backups: readonly VaultBackup[];
  readonly nextCursor: string | null;
}

/** Filesystem and SQLite details are kept behind the vault capability boundary. */
export interface VaultBackupStore {
  create(vaultPath: string, kind: VaultBackupKind): Promise<VaultBackup>;
  list(vaultPath: string, beforeId?: string | null): VaultBackupPage;
  verify(vaultPath: string, backupId: string): VaultBackup;
  restore(vaultPath: string, backupId: string, destinationPath: string): Promise<string>;
}
