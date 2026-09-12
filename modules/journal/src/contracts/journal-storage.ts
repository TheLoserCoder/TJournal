import type { ClosedTrade, CreateClosedTradeInput } from '../domain/closed-trade';
import type { CreateInstrumentInput, Instrument } from '../domain/instrument';
import type { VaultDescriptor, VaultStatus } from '../domain/vault';

export interface JournalStorage {
  checkIntegrity(): void;
  close(): void;
  createTrade(input: CreateClosedTradeInput & { readonly id: string }): ClosedTrade;
  createInstrument(input: CreateInstrumentInput & { readonly id: string }): Instrument;
  createVault(vaultPath: string): VaultDescriptor;
  deleteInstrument(id: string): Instrument;
  deleteTrade(id: string): ClosedTrade;
  getStatus(): VaultStatus;
  listInstruments(): readonly Instrument[];
  listTrades(): readonly ClosedTrade[];
  openVault(vaultPath: string): VaultDescriptor;
  updateTrade(trade: ClosedTrade): ClosedTrade;
}
