import type { SqliteVaultDatabase } from '@tjournal/platform-database';

import type { CommandTransaction } from '../application/command-transaction';

export class SqliteCommandTransaction implements CommandTransaction {
  public constructor(private readonly vaultDatabase: SqliteVaultDatabase) {}

  public execute<T>(operation: () => T): T {
    return this.vaultDatabase.transaction(operation);
  }
}
