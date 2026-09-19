import type { AccountStore } from '../contracts/account-store';

export class ListAccountsUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute() {
    return this.accountStore.listAccounts();
  }
}
