// @vitest-environment node
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CreateVaultBackupUseCase, OpenVaultUseCase } from '@tjournal/journal';

import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteVaultBackupStore } from './sqlite-vault-backup-store';
import { SqliteVaultDatabase } from './sqlite-vault-database';

const directories: string[] = [];
const workspace = (): string => {
  const path = mkdtempSync(join(tmpdir(), 'tjournal-backup-'));
  directories.push(path);
  return path;
};

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { force: true, recursive: true });
});

const fixture = () => {
  const parent = workspace();
  const vaultPath = join(parent, 'source');
  const database = new SqliteVaultDatabase();
  const storage = new SqliteJournalStorage(database);
  const descriptor = storage.createVault(vaultPath);
  const backups = new SqliteVaultBackupStore(storage, '0.1.0');
  return { parent, vaultPath, database, storage, descriptor, backups };
};

describe('SQLite vault backups', () => {
  it('captures committed WAL data and restores a distinct vault without switching the source', async () => {
    const { parent, vaultPath, database, storage, descriptor, backups } = fixture();
    try {
      database
        .require()
        .prepare(
          `INSERT INTO accounts
        (id, name, opening_balance_usd, default_risk_usd, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run('account-test', 'Test', '100', null, '2026-09-23', '2026-09-23');
      const backup = await backups.create(vaultPath, 'manual');
      expect(backups.verify(vaultPath, backup.id)).toEqual(backup);
      const restored = join(parent, 'restored');
      await backups.restore(vaultPath, backup.id, restored);
      const copy = storage.inspectVault(restored);
      expect(copy.vaultId).not.toBe(descriptor.vaultId);
      expect(
        JSON.parse(readFileSync(join(restored, '.tjournal-vault.json'), 'utf8')),
      ).toMatchObject({ restoredFromVaultId: descriptor.vaultId, restoredFromBackupId: backup.id });
      expect(storage.getStatus().path).toBe(vaultPath);
      const reader = new SqliteVaultDatabase();
      try {
        reader.openReadOnly(join(restored, 'journal.sqlite'));
        expect(
          reader.require().prepare('SELECT name FROM accounts WHERE id = ?').get('account-test'),
        ).toMatchObject({ name: 'Test' });
      } finally {
        reader.close();
      }
      expect(readdirSync(join(restored, 'attachments'))).toEqual([]);
    } finally {
      storage.close();
    }
  });

  it('ignores interrupted backups and rejects changed bytes or an occupied restore target', async () => {
    const { parent, vaultPath, storage, backups } = fixture();
    try {
      const snapshot = await backups.create(vaultPath, 'manual');
      mkdirSync(join(vaultPath, 'backups', '.pending-interrupted'));
      expect(backups.list(vaultPath).backups.map((backup) => backup.id)).toEqual([snapshot.id]);
      const occupied = join(parent, 'occupied');
      mkdirSync(occupied);
      writeFileSync(join(occupied, 'user.txt'), 'keep');
      await expect(backups.restore(vaultPath, snapshot.id, occupied)).rejects.toMatchObject({
        code: 'restore-failed',
      });
      expect(readFileSync(join(occupied, 'user.txt'), 'utf8')).toBe('keep');
      writeFileSync(join(vaultPath, 'backups', snapshot.id, 'journal.sqlite'), 'corrupt');
      expect(backups.list(vaultPath).backups).toEqual([]);
      expect(() => backups.verify(vaultPath, snapshot.id)).toThrow();
      await expect(
        backups.restore(vaultPath, snapshot.id, join(parent, 'copy')),
      ).rejects.toMatchObject({ code: 'backup-invalid' });
    } finally {
      storage.close();
    }
  });

  it('does not migrate or activate a candidate when its required backup fails', async () => {
    const { parent, vaultPath, storage, backups } = fixture();
    const candidate = join(parent, 'legacy');
    const legacyStorage = new SqliteJournalStorage();
    try {
      legacyStorage.createVault(candidate);
      legacyStorage.close();
      const legacy = new SqliteVaultDatabase();
      legacy.open(join(candidate, 'journal.sqlite'), candidate);
      legacy
        .require()
        .prepare('DELETE FROM tjournal_migrations WHERE id = ?')
        .run('001-initial-journal-schema');
      legacy.close();
      expect(storage.pendingMigrations(candidate)).toContain('001-initial-journal-schema');
      const failedBackup = new CreateVaultBackupUseCase({
        ...backups,
        create: async () => {
          throw new Error('disk full');
        },
        list: (path) => backups.list(path),
        verify: (path, id) => backups.verify(path, id),
        restore: (path, id, dest) => backups.restore(path, id, dest),
      });
      await expect(new OpenVaultUseCase(storage, failedBackup).execute(candidate)).rejects.toThrow(
        'disk full',
      );
      expect(storage.getStatus().path).toBe(vaultPath);
      expect(storage.pendingMigrations(candidate)).toContain('001-initial-journal-schema');
      await new OpenVaultUseCase(storage, new CreateVaultBackupUseCase(backups)).execute(candidate);
      expect(backups.list(candidate).backups).toHaveLength(1);
      expect(storage.pendingMigrations(candidate)).toEqual([]);
    } finally {
      storage.close();
      legacyStorage.close();
    }
  });

  it('retains manual backups and only the newest twenty valid automatic backups', async () => {
    const { vaultPath, storage, backups } = fixture();
    try {
      const manual = await backups.create(vaultPath, 'manual');
      for (let index = 0; index < 21; index += 1) await backups.create(vaultPath, 'automatic');
      const saved = backups.list(vaultPath).backups;
      expect(saved.filter((item) => item.kind === 'automatic')).toHaveLength(20);
      expect(saved.some((item) => item.id === manual.id)).toBe(true);
      writeFileSync(join(vaultPath, 'backups', 'unrelated.txt'), 'keep');
      await backups.create(vaultPath, 'automatic');
      expect(readFileSync(join(vaultPath, 'backups', 'unrelated.txt'), 'utf8')).toBe('keep');
      expect(backups.verify(vaultPath, manual.id)).toEqual(manual);
    } finally {
      storage.close();
    }
  });

  it('rejects malformed and unsupported manifests without deleting their snapshots', async () => {
    const { vaultPath, storage, backups } = fixture();
    try {
      const snapshot = await backups.create(vaultPath, 'manual');
      const path = join(vaultPath, 'backups', snapshot.id, 'manifest.json');
      const manifest = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      writeFileSync(path, JSON.stringify({ ...manifest, formatVersion: 999 }));
      expect(() => backups.verify(vaultPath, snapshot.id)).toThrow();
      expect(backups.list(vaultPath).backups).toEqual([]);
      expect(
        readFileSync(join(vaultPath, 'backups', snapshot.id, 'journal.sqlite')).length,
      ).toBeGreaterThan(0);
    } finally {
      storage.close();
    }
  });

  it('opens an up-to-date vault without creating an automatic backup', async () => {
    const { vaultPath, storage, backups } = fixture();
    try {
      await new OpenVaultUseCase(storage, new CreateVaultBackupUseCase(backups)).execute(vaultPath);
      expect(backups.list(vaultPath).backups).toEqual([]);
    } finally {
      storage.close();
    }
  });

  it('pages the unpruned manual archive without losing older backup IDs', async () => {
    const { vaultPath, storage, backups } = fixture();
    try {
      for (let index = 0; index < 51; index += 1) await backups.create(vaultPath, 'manual');
      const first = backups.list(vaultPath);
      expect(first.backups).toHaveLength(50);
      expect(first.nextCursor).not.toBeNull();
      const second = backups.list(vaultPath, first.nextCursor);
      expect(second.backups).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
      const oldest = second.backups[0];
      if (oldest === undefined) throw new Error('Oldest backup was not listed.');
      expect(backups.verify(vaultPath, oldest.id)).toEqual(oldest);
    } finally {
      storage.close();
    }
  });

  it('recovers from an unreadable source database using only its verified backup', async () => {
    const { parent, vaultPath, storage, backups } = fixture();
    const backup = await backups.create(vaultPath, 'manual');
    storage.close();
    writeFileSync(join(vaultPath, 'journal.sqlite'), 'damaged database');
    expect(() => storage.inspectVault(vaultPath)).toThrow();
    const destination = join(parent, 'recovered');
    await backups.restore(vaultPath, backup.id, destination);
    expect(storage.inspectVault(destination).vaultId).not.toBe(backup.sourceVaultId);
    const offlineDestination = join(parent, 'offline-recovered');
    execFileSync(process.execPath, [
      join(process.cwd(), 'tools', 'recover-vault.mjs'),
      vaultPath,
      backup.id,
      offlineDestination,
    ]);
    expect(storage.inspectVault(offlineDestination).vaultId).not.toBe(backup.sourceVaultId);
  });
});
