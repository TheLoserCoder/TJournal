import type { DatabaseSync } from 'node:sqlite';

import Decimal from 'decimal.js';

export const SQLITE_JOURNAL_TABLE_FUNCTIONS = {
  decimalComparator: 'tjournal_decimal_cmp',
  unicodeLowercase: 'tjournal_unicode_lowercase',
} as const;

export const registerSqliteJournalTableFunctions = (database: DatabaseSync): void => {
  database.function(
    SQLITE_JOURNAL_TABLE_FUNCTIONS.decimalComparator,
    { deterministic: true },
    (left, right) => {
      if (left === null || right === null) return null;
      try {
        return new Decimal(String(left)).comparedTo(String(right));
      } catch {
        return null;
      }
    },
  );
  database.function(
    SQLITE_JOURNAL_TABLE_FUNCTIONS.unicodeLowercase,
    { deterministic: true },
    (value) => (value === null ? null : String(value).toLowerCase()),
  );
};
