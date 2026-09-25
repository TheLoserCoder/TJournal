import type { AccountStore } from '../contracts/account-store';
import type { TradingAccount } from '../domain/account';

/** Point lookup for a single account without projecting every account balance. */
export class GetAccountByIdUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute(id: string): TradingAccount | null {
    return this.accountStore.getAccountById(id);
  }
}
