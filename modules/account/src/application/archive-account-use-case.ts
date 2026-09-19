import type { AccountStore } from '../contracts/account-store';

export class ArchiveAccountUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute(id: string) {
    return this.accountStore.archiveAccount(id);
  }
}
