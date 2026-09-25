import type { AccountStore } from '../contracts/account-store';
import type { AccountInstrumentDefaults, TradingAccount } from '../domain/account';

/**
 * Restores a whole account aggregate, including entry-time defaults, to a
 * previously captured snapshot. Used by Undo when a delete was physical or an
 * update must be reverted exactly.
 */
export class RestoreAccountSnapshotUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute(account: TradingAccount, defaults: readonly AccountInstrumentDefaults[]): void {
    this.accountStore.restoreAccount(account, defaults);
  }
}
