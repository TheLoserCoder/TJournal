import type { AccountStore } from '../contracts/account-store';

export class ListCashMovementsUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute() {
    return this.accountStore.listCashMovements();
  }
}
