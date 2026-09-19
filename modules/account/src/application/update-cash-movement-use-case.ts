import type { AccountStore } from '../contracts/account-store';
import { normalizePositiveUsd, type UpdateCashMovementInput } from '../domain/account';

export class UpdateCashMovementUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute(input: UpdateCashMovementInput) {
    return this.accountStore.updateCashMovement({
      ...input,
      amountUsd: normalizePositiveUsd(input.amountUsd),
    });
  }
}
