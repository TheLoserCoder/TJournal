import type { AccountStore } from '../contracts/account-store';
import type { AccountInstrumentDefaults } from '../domain/account';

/** Defaults that reference one instrument across every account. */
export class ListInstrumentDefaultsUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute(instrumentId: string): readonly AccountInstrumentDefaults[] {
    return this.accountStore.listDefaultsForInstrument(instrumentId);
  }
}
