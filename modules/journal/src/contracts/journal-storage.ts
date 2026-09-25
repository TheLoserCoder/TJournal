import type { VaultDescriptor, VaultStatus } from '../domain/vault';

/** Vault lifecycle only: the instrument catalog is owned by `modules/instrument`. */
export interface JournalStorage {
  checkIntegrity(): void;
  close(): void;
  createVault(vaultPath: string): VaultDescriptor;
  getStatus(): VaultStatus;
  inspectVault(vaultPath: string): VaultDescriptor;
  /** Reads the migration ledger on a separate, read-only connection. */
  pendingMigrations(vaultPath: string): readonly string[];
  /**
   * Opens the vault as the active session. When the candidate cannot be opened
   * or migrated, the previously active vault must stay untouched.
   */
  openVault(vaultPath: string): VaultDescriptor;
}
