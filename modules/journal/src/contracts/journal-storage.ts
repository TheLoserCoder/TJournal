import type { CreateInstrumentInput, Instrument } from '../domain/instrument';
import type { VaultDescriptor, VaultStatus } from '../domain/vault';

export interface JournalStorage {
  checkIntegrity(): void;
  close(): void;
  createInstrument(input: CreateInstrumentInput & { readonly id: string }): Instrument;
  createVault(vaultPath: string): VaultDescriptor;
  deleteInstrument(id: string): Instrument;
  getStatus(): VaultStatus;
  listInstruments(): readonly Instrument[];
  openVault(vaultPath: string): VaultDescriptor;
}
