import { randomUUID } from 'node:crypto';
import type { AccountStore } from '../contracts/account-store';
import {
  normalizeAccountDefaults,
  normalizeAccountName,
  normalizeNonNegativeUsd,
  type CreateTradingAccountInput,
  type TradingAccount,
} from '../domain/account';

export class CreateAccountUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute(input: CreateTradingAccountInput, id: string = randomUUID()): TradingAccount {
    return this.accountStore.createAccount({
      ...input,
      id,
      name: normalizeAccountName(input.name),
      openingBalanceUsd: normalizeNonNegativeUsd(input.openingBalanceUsd),
      defaults: input.defaults === undefined ? undefined : normalizeAccountDefaults(input.defaults),
    });
  }
}
