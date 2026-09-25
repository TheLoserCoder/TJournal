import type { DatabaseSync, StatementSync } from 'node:sqlite';

import { vi } from 'vitest';

import { SqliteVaultDatabase } from '../sqlite-vault-database';

export interface QueryCounter {
  count(): number;
  reset(): void;
  restore(): void;
}

/**
 * Counts prepared statements per operation. Adapters never reuse statement
 * objects across calls, so the counter is a stable proxy for query count.
 */
export const countDatabaseQueries = (database: SqliteVaultDatabase): QueryCounter => {
  let prepared = 0;
  const originalRequire = SqliteVaultDatabase.prototype.require;
  const spy = vi.spyOn(database, 'require').mockImplementation((): DatabaseSync => {
    const target = originalRequire.call(database);
    return new Proxy(target, {
      get(inner, property) {
        if (property === 'prepare') {
          return (sql: string): StatementSync => {
            prepared += 1;
            return inner.prepare(sql);
          };
        }
        const value: unknown = Reflect.get(inner, property, inner);
        return typeof value === 'function' ? value.bind(inner) : value;
      },
    });
  });
  return {
    count: () => prepared,
    reset: () => {
      prepared = 0;
    },
    restore: () => {
      spy.mockRestore();
    },
  };
};
