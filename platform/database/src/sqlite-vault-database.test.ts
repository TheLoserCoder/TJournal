// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { SqliteVaultDatabase } from './sqlite-vault-database';

const createTemporaryDirectory = (): string => mkdtempSync(join(tmpdir(), 'tjournal-'));

const insertValue = (database: SqliteVaultDatabase, value: string): void => {
  database.require().prepare('INSERT INTO values_table (value) VALUES (?)').run(value);
};

const readValues = (database: SqliteVaultDatabase): readonly string[] => {
  const rows = database
    .require()
    .prepare('SELECT value FROM values_table ORDER BY rowid')
    .all() as unknown as readonly { readonly value: string }[];
  return rows.map((row) => row.value);
};

describe('SqliteVaultDatabase nested transactions', () => {
  it('commits savepoint work together with the outer transaction', () => {
    const parentDirectory = createTemporaryDirectory();
    const database = new SqliteVaultDatabase();

    try {
      database.open(join(parentDirectory, 'journal.sqlite'), parentDirectory);
      database.require().exec('CREATE TABLE values_table (value TEXT NOT NULL)');

      database.transaction(() => {
        insertValue(database, 'outer');
        database.transaction(() => {
          insertValue(database, 'inner');
        });
      });

      expect(readValues(database)).toEqual(['outer', 'inner']);
    } finally {
      database.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('rolls back only the failed savepoint when the outer operation handles the error', () => {
    const parentDirectory = createTemporaryDirectory();
    const database = new SqliteVaultDatabase();

    try {
      database.open(join(parentDirectory, 'journal.sqlite'), parentDirectory);
      database.require().exec('CREATE TABLE values_table (value TEXT NOT NULL)');

      database.transaction(() => {
        insertValue(database, 'outer-before');
        expect(() =>
          database.transaction(() => {
            insertValue(database, 'inner');
            throw new Error('inner failure');
          }),
        ).toThrow('inner failure');
        insertValue(database, 'outer-after');
      });

      expect(readValues(database)).toEqual(['outer-before', 'outer-after']);
    } finally {
      database.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('rolls back everything when the savepoint error reaches the outer transaction', () => {
    const parentDirectory = createTemporaryDirectory();
    const database = new SqliteVaultDatabase();

    try {
      database.open(join(parentDirectory, 'journal.sqlite'), parentDirectory);
      database.require().exec('CREATE TABLE values_table (value TEXT NOT NULL)');

      expect(() =>
        database.transaction(() => {
          insertValue(database, 'first');
          database.transaction(() => {
            insertValue(database, 'second');
            throw new Error('savepoint failure');
          });
        }),
      ).toThrow('savepoint failure');

      expect(readValues(database)).toEqual([]);

      database.transaction(() => insertValue(database, 'recovered'));
      expect(readValues(database)).toEqual(['recovered']);
    } finally {
      database.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('restores transaction depth when commit fails', () => {
    const parentDirectory = createTemporaryDirectory();
    const database = new SqliteVaultDatabase();

    try {
      database.open(join(parentDirectory, 'journal.sqlite'), parentDirectory);
      const sqlite = database.require();
      sqlite.exec('CREATE TABLE values_table (value TEXT NOT NULL)');
      const originalExec = sqlite.exec.bind(sqlite);
      const exec = vi.spyOn(sqlite, 'exec').mockImplementation((sql) => {
        if (sql === 'COMMIT') throw new Error('commit failure');
        originalExec(sql);
      });

      expect(() => database.transaction(() => insertValue(database, 'failed'))).toThrow(
        'commit failure',
      );
      exec.mockRestore();

      database.transaction(() => insertValue(database, 'recovered'));
      expect(readValues(database)).toEqual(['recovered']);
    } finally {
      vi.restoreAllMocks();
      database.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('keeps the active connection when its replacement cannot be opened', () => {
    const parentDirectory = createTemporaryDirectory();
    const database = new SqliteVaultDatabase();

    try {
      database.open(join(parentDirectory, 'journal.sqlite'), parentDirectory);
      database.require().exec('CREATE TABLE values_table (value TEXT NOT NULL)');
      insertValue(database, 'active');

      expect(() => database.open(parentDirectory, parentDirectory)).toThrow();

      expect(readValues(database)).toEqual(['active']);
      expect(database.getPath()).toBe(parentDirectory);
    } finally {
      database.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });
});
