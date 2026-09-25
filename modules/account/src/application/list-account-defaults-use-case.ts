import type { AccountStore } from '../contracts/account-store';
import type { AccountInstrumentDefaults } from '../domain/account';

/** Entry-time defaults configured for one account. */
export class ListAccountDefaultsUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute(accountId: string): readonly AccountInstrumentDefaults[] {
    return this.accountStore.listAccountDefaults(accountId);
  }
}
