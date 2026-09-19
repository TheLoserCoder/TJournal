import type { AccountStore } from '../contracts/account-store';

export class DeleteCashMovementUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute(id: string) {
    return this.accountStore.deleteCashMovement(id);
  }
}
