import type { AccountStore } from '../contracts/account-store';
import {
  normalizeAccountDefaults,
  normalizeAccountName,
  normalizeNonNegativeUsd,
  type UpdateTradingAccountInput,
} from '../domain/account';

export class UpdateAccountUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute(input: UpdateTradingAccountInput) {
    return this.accountStore.updateAccount({
      ...input,
      name: normalizeAccountName(input.name),
      openingBalanceUsd: normalizeNonNegativeUsd(input.openingBalanceUsd),
      defaults: normalizeAccountDefaults(input.defaults),
    });
  }
}
