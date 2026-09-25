import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  opendirSync,
  openSync,
  realpathSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { backup } from 'node:sqlite';

import type { VaultBackup, VaultBackupKind, VaultBackupStore } from '@tjournal/journal';
import { AppError } from '@tjournal/platform-errors';
import type { Logger } from '@tjournal/platform-observability';

import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteVaultDatabase } from './sqlite-vault-database';
import {
  AUTOMATIC_BACKUP_RETENTION,
  backupManifestSchema,
  BACKUP_FORMAT_VERSION,
  type VaultBackupManifest,
} from './vault-backup-manifest';
import {
  ATTACHMENTS_DIRECTORY_NAME,
  BACKUPS_DIRECTORY_NAME,
  DATABASE_FILE_NAME,
  MARKER_FILE_NAME,
  VAULT_FORMAT_VERSION,
} from './vault-layout';

const MANIFEST_FILE_NAME = 'manifest.json';
const HASH_CHUNK_BYTES = 64 * 1024;
const BACKUP_PAGE_SIZE = 50;
const BACKUP_ID_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f-]{36}$/;

const checksum = (path: string): string => {
  const descriptor = openSync(path, 'r');
  const buffer = Buffer.alloc(HASH_CHUNK_BYTES);
  const hash = createHash('sha256');
  try {
    let length: number;
    while ((length = readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, length));
    }
    return hash.digest('hex');
  } finally {
    closeSync(descriptor);
  }
};

const backupError = (
  code: 'backup-invalid' | 'backup-failed' | 'restore-failed',
  cause: unknown,
): AppError => new AppError({ code, cause, message: `${code}: vault backup operation failed.` });

const asBackup = (manifest: VaultBackupManifest): VaultBackup => ({
  id: manifest.id,
  kind: manifest.kind,
  createdAt: manifest.createdAt,
  sourceVaultId: manifest.sourceVaultId,
  databaseBytes: manifest.databaseBytes,
});

const isWithin = (parent: string, candidate: string): boolean => {
  const path = relative(resolve(parent), resolve(candidate));
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
};

export class SqliteVaultBackupStore implements VaultBackupStore {
  private readonly creating = new Set<string>();

  public constructor(
    private readonly journalStorage: SqliteJournalStorage,
    private readonly appVersion: string,
    private readonly logger?: Logger,
  ) {}

  public async create(vaultPath: string, kind: VaultBackupKind): Promise<VaultBackup> {
    const started = Date.now();
    const vault = resolve(vaultPath);
    if (this.creating.has(vault)) throw backupError('backup-failed', 'Backup already in progress');
    this.creating.add(vault);
    const root = join(vault, BACKUPS_DIRECTORY_NAME);
    const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
    const staging = join(root, `.pending-${id}`);
    const final = join(root, id);
    const source = new SqliteVaultDatabase();
    try {
      const descriptor = this.journalStorage.inspectVault(vault);
      if (existsSync(root) && !lstatSync(root).isDirectory()) {
        throw backupError('backup-failed', 'Backup directory must be a real directory');
      }
      mkdirSync(root, { recursive: true });
      mkdirSync(staging);
      source.openReadOnly(join(vault, DATABASE_FILE_NAME));
      const migrationIds = source.appliedMigrations();
      await backup(source.require(), join(staging, DATABASE_FILE_NAME));
      const databasePath = join(staging, DATABASE_FILE_NAME);
      this.checkSnapshot(databasePath);
      const manifest: VaultBackupManifest = {
        formatVersion: BACKUP_FORMAT_VERSION,
        id,
        kind,
        createdAt: new Date().toISOString(),
        sourceVaultId: descriptor.vaultId,
        appVersion: this.appVersion,
        migrationIds: [...migrationIds],
        databaseSha256: checksum(databasePath),
        databaseBytes: statSync(databasePath).size,
        attachmentsIncluded: false,
      };
      writeFileSync(join(staging, MANIFEST_FILE_NAME), JSON.stringify(manifest), { flag: 'wx' });
      this.readVerified(staging, id);
      renameSync(staging, final);
      if (kind === 'automatic') this.pruneAutomatic(root);
      this.logger?.info('vault.backup-created', {
        kind,
        databaseBytes: String(manifest.databaseBytes),
        durationMs: String(Date.now() - started),
      });
      return asBackup(manifest);
    } catch (error) {
      if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
      this.logger?.error('vault.backup-failed', { kind, code: 'backup-failed' });
      if (error instanceof AppError && error.code === 'backup-failed') throw error;
      throw backupError('backup-failed', error);
    } finally {
      source.close();
      this.creating.delete(vault);
    }
  }

  public list(
    vaultPath: string,
    beforeId: string | null = null,
  ): { readonly backups: readonly VaultBackup[]; readonly nextCursor: string | null } {
    const root = join(vaultPath, BACKUPS_DIRECTORY_NAME);
    if (!existsSync(root)) return { backups: [], nextCursor: null };
    if (!lstatSync(root).isDirectory())
      throw backupError('backup-invalid', 'Backup directory is not a directory');
    const names: string[] = [];
    const directory = opendirSync(root);
    try {
      let entry;
      while ((entry = directory.readSync()) !== null) {
        if (
          !entry.isDirectory() ||
          !BACKUP_ID_PATTERN.test(entry.name) ||
          (beforeId !== null && entry.name >= beforeId)
        )
          continue;
        names.push(entry.name);
        names.sort((a, b) => b.localeCompare(a));
        if (names.length > BACKUP_PAGE_SIZE + 1) names.pop();
      }
    } finally {
      directory.closeSync();
    }
    const hasMore = names.length > BACKUP_PAGE_SIZE;
    const pageNames = names.slice(0, BACKUP_PAGE_SIZE);
    const backups = pageNames.flatMap((id) => {
      try {
        return [asBackup(this.readVerified(join(root, id), id))];
      } catch {
        return [];
      }
    });
    return { backups, nextCursor: hasMore ? (pageNames.at(-1) ?? null) : null };
  }

  public verify(vaultPath: string, backupId: string): VaultBackup {
    return asBackup(this.selected(vaultPath, backupId));
  }

  public async restore(
    vaultPath: string,
    backupId: string,
    destinationPath: string,
  ): Promise<string> {
    const manifest = this.selected(vaultPath, backupId);
    const destination = resolve(destinationPath);
    const sourceReal = realpathSync(vaultPath);
    const parentReal = realpathSync(dirname(destination));
    if (isWithin(sourceReal, parentReal) || isWithin(destination, sourceReal)) {
      throw backupError('restore-failed', 'Destination overlaps source vault');
    }
    if (existsSync(destination)) {
      if (
        !lstatSync(destination).isDirectory() ||
        readdirSync(destination).length !== 0 ||
        isWithin(sourceReal, realpathSync(destination))
      ) {
        throw backupError('restore-failed', 'Destination must be an empty directory');
      }
    }
    const staging = join(dirname(destination), `.tjournal-restore-${randomUUID()}`);
    let finalized = false;
    let removedEmptyDestination = false;
    try {
      mkdirSync(staging);
      mkdirSync(join(staging, ATTACHMENTS_DIRECTORY_NAME));
      mkdirSync(join(staging, BACKUPS_DIRECTORY_NAME));
      copyFileSync(
        join(vaultPath, BACKUPS_DIRECTORY_NAME, backupId, DATABASE_FILE_NAME),
        join(staging, DATABASE_FILE_NAME),
      );
      if (checksum(join(staging, DATABASE_FILE_NAME)) !== manifest.databaseSha256) {
        throw backupError('backup-invalid', 'Snapshot changed during restore');
      }
      writeFileSync(
        join(staging, MARKER_FILE_NAME),
        JSON.stringify({
          createdAt: new Date().toISOString(),
          formatVersion: VAULT_FORMAT_VERSION,
          vaultId: randomUUID(),
          restoredFromVaultId: manifest.sourceVaultId,
          restoredFromBackupId: backupId,
        }),
        { flag: 'wx' },
      );
      this.journalStorage.inspectVault(staging);
      if (existsSync(destination)) {
        if (!lstatSync(destination).isDirectory() || readdirSync(destination).length !== 0) {
          throw backupError('restore-failed', 'Destination is no longer empty');
        }
        rmdirSync(destination);
        removedEmptyDestination = true;
      }
      renameSync(staging, destination);
      finalized = true;
      return destination;
    } catch (error) {
      if (error instanceof AppError && error.code === 'restore-failed') throw error;
      throw backupError('restore-failed', error);
    } finally {
      if (!finalized && existsSync(staging)) rmSync(staging, { recursive: true, force: true });
      if (!finalized && removedEmptyDestination && !existsSync(destination)) mkdirSync(destination);
    }
  }

  private selected(vaultPath: string, backupId: string): VaultBackupManifest {
    const root = join(vaultPath, BACKUPS_DIRECTORY_NAME);
    const directory = join(root, backupId);
    if (
      !BACKUP_ID_PATTERN.test(backupId) ||
      !existsSync(root) ||
      !lstatSync(root).isDirectory() ||
      !existsSync(directory) ||
      !lstatSync(directory).isDirectory()
    ) {
      throw backupError('backup-invalid', 'Backup ID is not listed for this vault');
    }
    return this.readVerified(directory, backupId);
  }

  private readVerified(directory: string, id: string): VaultBackupManifest {
    try {
      const manifestPath = join(directory, MANIFEST_FILE_NAME);
      const databasePath = join(directory, DATABASE_FILE_NAME);
      if (!lstatSync(manifestPath).isFile() || !lstatSync(databasePath).isFile())
        throw new Error('Not a regular file');
      const manifest = backupManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
      if (
        manifest.id !== id ||
        statSync(databasePath).size !== manifest.databaseBytes ||
        checksum(databasePath) !== manifest.databaseSha256
      )
        throw new Error('Backup checksum mismatch');
      const migrationIds = this.checkSnapshot(databasePath);
      if (JSON.stringify(migrationIds) !== JSON.stringify(manifest.migrationIds)) {
        throw new Error('Backup migration ledger mismatch');
      }
      return manifest;
    } catch (error) {
      throw backupError('backup-invalid', error);
    }
  }

  private checkSnapshot(databasePath: string): readonly string[] {
    const database = new SqliteVaultDatabase();
    try {
      database.openReadOnly(databasePath);
      const row = database.require().prepare('PRAGMA integrity_check').get() as
        { integrity_check?: unknown } | undefined;
      if (row?.integrity_check !== 'ok') throw new Error('SQLite integrity check failed');
      return database.appliedMigrations();
    } finally {
      database.close();
    }
  }

  private pruneAutomatic(root: string): void {
    let cursor: string | null = null;
    let retained = 0;
    do {
      const page = this.list(dirname(root), cursor);
      for (const item of page.backups) {
        if (item.kind !== 'automatic') continue;
        retained += 1;
        if (retained > AUTOMATIC_BACKUP_RETENTION) rmSync(join(root, item.id), { recursive: true });
      }
      cursor = page.nextCursor;
    } while (cursor !== null);
  }
}
