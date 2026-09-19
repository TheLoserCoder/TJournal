import type { AccountStore } from '../contracts/account-store';

export class RestoreAccountUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute(id: string) {
    return this.accountStore.restoreArchivedAccount(id);
  }
}
