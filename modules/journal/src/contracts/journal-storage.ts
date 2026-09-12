import type { ClosedTrade, CreateClosedTradeInput } from '../domain/closed-trade';
import type { VaultDescriptor, VaultStatus } from '../domain/vault';

export interface JournalStorage {
  checkIntegrity(): void;
  close(): void;
  createTrade(input: CreateClosedTradeInput & { readonly id: string }): ClosedTrade;
  createVault(vaultPath: string): VaultDescriptor;
  getStatus(): VaultStatus;
  listTrades(): readonly ClosedTrade[];
  openVault(vaultPath: string): VaultDescriptor;
}
