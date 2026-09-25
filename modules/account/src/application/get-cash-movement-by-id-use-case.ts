import type { AccountStore } from '../contracts/account-store';
import type { CashMovement } from '../domain/account';

/** Point lookup for one movement without listing the whole cash flow. */
export class GetCashMovementByIdUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute(id: string): CashMovement | null {
    return this.accountStore.getCashMovement(id);
  }
}
