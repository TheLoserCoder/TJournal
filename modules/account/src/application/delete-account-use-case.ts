import type { AccountStore } from '../contracts/account-store';

export class DeleteAccountUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute(id: string) {
    return this.accountStore.deleteAccount(id);
  }
}
