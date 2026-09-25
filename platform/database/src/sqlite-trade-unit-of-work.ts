import type { TradeUnitOfWork } from '@tjournal/trade';

import { SqliteVaultDatabase } from './sqlite-vault-database';

export class SqliteTradeUnitOfWork implements TradeUnitOfWork {
  public constructor(private readonly vaultDatabase: SqliteVaultDatabase) {}

  public execute<T>(operation: () => T): T {
    return this.vaultDatabase.transaction(operation);
  }
}
