import { randomUUID } from 'node:crypto';

import type { AccountStore } from '../contracts/account-store';
import {
  normalizePositiveUsd,
  type CashMovement,
  type CreateCashMovementInput,
} from '../domain/account';

export class CreateCashMovementUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute(input: CreateCashMovementInput, id: string = randomUUID()): CashMovement {
    return this.accountStore.createCashMovement({
      ...input,
      amountUsd: normalizePositiveUsd(input.amountUsd),
      id,
    });
  }
}
