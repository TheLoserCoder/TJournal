// @vitest-environment node

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { AppError } from '@tjournal/platform-errors';

import { SqliteJournalStorage } from './sqlite-journal-storage';

const createTemporaryDirectory = (): string => mkdtempSync(join(tmpdir(), 'tjournal-'));

describe('SqliteJournalStorage', () => {
  it('creates a vault, persists a trade, and can open it again', () => {
    const parentDirectory = createTemporaryDirectory();
    const vaultPath = join(parentDirectory, 'journal');
    const storage = new SqliteJournalStorage();

    try {
      const descriptor = storage.createVault(vaultPath);
      const instrument = storage.listInstruments()[0];
      if (instrument === undefined) throw new Error('Seed instrument is missing.');
      storage.createTrade({
        closedAt: '2026-09-13T12:00:00.000Z',
        id: 'trade-1',
        instrumentId: instrument.id,
        resultKind: 'cash',
        resultValue: '12.50',
      });

      expect(descriptor.path).toBe(vaultPath);
      expect(existsSync(join(vaultPath, 'attachments'))).toBe(true);
      expect(existsSync(join(vaultPath, 'backups'))).toBe(true);
      expect(existsSync(join(vaultPath, 'journal.sqlite'))).toBe(true);
      expect(
        JSON.parse(readFileSync(join(vaultPath, '.tjournal-vault.json'), 'utf8')),
      ).toMatchObject({ formatVersion: 1 });
      expect(storage.listTrades()).toEqual([
        expect.objectContaining({ id: 'trade-1', resultValue: '12.50' }),
      ]);
      storage.close();

      storage.openVault(vaultPath);
      storage.checkIntegrity();
      expect(storage.listTrades()).toHaveLength(1);
    } finally {
      storage.close();
      rmSync(parentDirectory, { force: true, recursive: true });
    }
  });

  it('refuses to initialise a non-empty directory', () => {
    const vaultPath = createTemporaryDirectory();
    const storage = new SqliteJournalStorage();
    mkdirSync(join(vaultPath, 'existing'));

    try {
      try {
        storage.createVault(vaultPath);
        throw new Error('Expected vault creation to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('vault-already-initialized');
      }
    } finally {
      storage.close();
      rmSync(vaultPath, { force: true, recursive: true });
    }
  });
});
