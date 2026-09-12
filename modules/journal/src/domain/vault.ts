export interface VaultDescriptor {
  readonly createdAt: string;
  readonly formatVersion: number;
  readonly path: string;
  readonly vaultId: string;
}

export interface VaultStatus {
  readonly isOpen: boolean;
  readonly path: string | null;
}
