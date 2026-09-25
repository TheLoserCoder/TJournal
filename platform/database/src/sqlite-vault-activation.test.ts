// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SqliteInstrumentStore } from './sqlite-instrument-store';
import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteVaultDatabase } from './sqlite-vault-database';

const createTemporaryDirectory = (): string => mkdtempSync(join(tmpdir(), 'tjournal-'));

describe('SqliteJournalStorage vault activation', () => {
  it('keeps the active vault when a candidate database cannot be migrated', () => {
    const parentDirectory = createTemporaryDirectory();
    const activeVaultPath = join(parentDirectory, 'active');
    const brokenVaultPath = join(parentDirectory, 'broken');
    const database = new SqliteVaultDatabase();
    const storage = new SqliteJournalStorage(database);

    try {
      storage.createVault(activeVaultPath);
      mkdirSync(brokenVaultPath, { recursive: true });
      writeFileSync(
        join(brokenVaultPath, '.tjournal-vault.json'),
        JSON.stringify({
          createdAt: '2026-09-21T00:00:00.000Z',
          formatVersion: 1,
          vaultId: 'broken-vault',
        }),
        'utf8',
      );
      writeFileSync(join(brokenVaultPath, 'journal.sqlite'), 'not a sqlite database', 'utf8');

      expect(() => storage.openVault(brokenVaultPath)).toThrow();

      expect(storage.getStatus()).toEqual({ isOpen: true, path: activeVaultPath });
      expect(new SqliteInstrumentStore(database).listInstruments().length).toBeGreaterThan(0);
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });
});
