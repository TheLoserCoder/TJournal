import type { AccountStore } from '../contracts/account-store';
import type { AccountInstrumentDefaults } from '../domain/account';

/**
 * Re-applies entry-time defaults that were removed with an instrument, keeping
 * every default configured after the snapshot intact.
 */
export class RestoreInstrumentDefaultsUseCase {
  public constructor(private readonly accountStore: AccountStore) {}

  public execute(snapshot: readonly AccountInstrumentDefaults[]): void {
    const restoredByAccount = new Map<string, AccountInstrumentDefaults[]>();
    for (const item of snapshot) {
      const restored = restoredByAccount.get(item.accountId) ?? [];
      restored.push(item);
      restoredByAccount.set(item.accountId, restored);
    }
    restoredByAccount.forEach((restored, accountId) => {
      const restoredInstrumentIds = new Set(restored.map((item) => item.instrumentId));
      const current = this.accountStore
        .listAccountDefaults(accountId)
        .filter((item) => !restoredInstrumentIds.has(item.instrumentId));
      this.accountStore.saveDefaults(accountId, [...current, ...restored]);
    });
  }
}
