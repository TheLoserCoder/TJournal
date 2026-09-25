import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AppError } from '@tjournal/platform-errors';
import type { JournalStorage, VaultDescriptor, VaultStatus } from '@tjournal/journal';

import { SqliteVaultDatabase } from './sqlite-vault-database';
import {
  ATTACHMENTS_DIRECTORY_NAME,
  BACKUPS_DIRECTORY_NAME,
  DATABASE_FILE_NAME,
  MARKER_FILE_NAME,
  VAULT_FORMAT_VERSION,
} from './vault-layout';

interface VaultMarker {
  readonly createdAt: string;
  readonly formatVersion: number;
  readonly vaultId: string;
}

const markerFilePath = (vaultPath: string): string => join(vaultPath, MARKER_FILE_NAME);
const toDescriptor = (vaultPath: string, marker: VaultMarker): VaultDescriptor => ({
  ...marker,
  path: vaultPath,
});
const createMarker = (): VaultMarker => ({
  createdAt: new Date().toISOString(),
  formatVersion: VAULT_FORMAT_VERSION,
  vaultId: randomUUID(),
});
const isVaultMarker = (value: unknown): value is VaultMarker => {
  if (typeof value !== 'object' || value === null) return false;
  const marker = value as Record<string, unknown>;
  return (
    marker.formatVersion === VAULT_FORMAT_VERSION &&
    typeof marker.createdAt === 'string' &&
    typeof marker.vaultId === 'string'
  );
};

export class SqliteJournalStorage implements JournalStorage {
  public constructor(private readonly vaultDatabase = new SqliteVaultDatabase()) {}

  public checkIntegrity(): void {
    const result = this.vaultDatabase.require().prepare('PRAGMA integrity_check').get() as
      { integrity_check?: unknown } | undefined;
    if (result?.integrity_check !== 'ok')
      throw new AppError({
        code: 'storage-integrity-failed',
        message: 'SQLite integrity check failed.',
      });
  }

  public close(): void {
    this.vaultDatabase.close();
  }

  public createVault(vaultPath: string): VaultDescriptor {
    if (existsSync(vaultPath) && readdirSync(vaultPath).length > 0) {
      throw new AppError({
        code: 'vault-already-initialized',
        message: 'Vault directory is not empty.',
      });
    }
    mkdirSync(vaultPath, { recursive: true });
    mkdirSync(join(vaultPath, ATTACHMENTS_DIRECTORY_NAME));
    mkdirSync(join(vaultPath, BACKUPS_DIRECTORY_NAME));
    const marker = createMarker();
    writeFileSync(markerFilePath(vaultPath), JSON.stringify(marker), 'utf8');
    this.migrateCandidate(vaultPath);
    this.openDatabase(vaultPath);
    return toDescriptor(vaultPath, marker);
  }

  public getStatus(): VaultStatus {
    return { isOpen: this.vaultDatabase.getPath() !== null, path: this.vaultDatabase.getPath() };
  }

  /**
   * Validates a vault folder without touching the active session: the marker must
   * be readable and well formed, the database file must exist, and SQLite must
   * report a healthy integrity check. A failing candidate never replaces the
   * currently open vault.
   */
  public inspectVault(vaultPath: string): VaultDescriptor {
    const marker = this.readMarker(vaultPath);
    this.checkDatabaseIntegrity(join(vaultPath, DATABASE_FILE_NAME));
    return toDescriptor(vaultPath, marker);
  }

  public pendingMigrations(vaultPath: string): readonly string[] {
    this.readMarker(vaultPath);
    const databasePath = join(vaultPath, DATABASE_FILE_NAME);
    if (!existsSync(databasePath)) {
      throw new AppError({ code: 'vault-invalid', message: 'Vault database is missing.' });
    }
    const candidate = new SqliteVaultDatabase();
    try {
      candidate.openReadOnly(databasePath);
      return candidate.pendingMigrations();
    } finally {
      candidate.close();
    }
  }

  public openVault(vaultPath: string): VaultDescriptor {
    const marker = this.readMarker(vaultPath);
    // Migrating the candidate on a separate connection keeps the active session
    // untouched when a vault fails to open or migrate.
    this.migrateCandidate(vaultPath);
    this.openDatabase(vaultPath);
    this.checkIntegrity();
    return toDescriptor(vaultPath, marker);
  }

  /**
   * Applies pending migrations on a throwaway connection so a failing candidate
   * cannot replace or close the currently open vault.
   */
  private migrateCandidate(vaultPath: string): void {
    const candidate = new SqliteVaultDatabase();
    try {
      candidate.open(join(vaultPath, DATABASE_FILE_NAME), vaultPath);
      candidate.migrate();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError({
        cause: error,
        code: 'vault-invalid',
        message: 'Vault migrations could not be applied.',
      });
    } finally {
      candidate.close();
    }
  }

  private checkDatabaseIntegrity(databasePath: string): void {
    if (!existsSync(databasePath)) {
      throw new AppError({
        code: 'vault-invalid',
        message: 'Vault database is missing.',
      });
    }
    const database = new SqliteVaultDatabase();
    try {
      database.openReadOnly(databasePath);
      const result = database.require().prepare('PRAGMA integrity_check').get() as
        { integrity_check?: unknown } | undefined;
      if (result?.integrity_check !== 'ok') {
        throw new AppError({
          code: 'storage-integrity-failed',
          message: 'SQLite integrity check failed.',
        });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError({
        cause: error,
        code: 'storage-integrity-failed',
        message: 'Vault database check failed.',
      });
    } finally {
      database.close();
    }
  }

  private openDatabase(vaultPath: string): void {
    this.vaultDatabase.open(join(vaultPath, DATABASE_FILE_NAME), vaultPath);
    this.vaultDatabase.migrate();
  }

  private readMarker(vaultPath: string): VaultMarker {
    if (!existsSync(vaultPath)) {
      throw new AppError({
        code: 'vault-not-accessible',
        message: 'Vault folder is not accessible.',
      });
    }
    let raw: string;
    try {
      raw = readFileSync(markerFilePath(vaultPath), 'utf8');
    } catch (error) {
      throw new AppError({
        cause: error,
        code: 'vault-invalid',
        message: 'Vault marker is missing or unreadable.',
      });
    }
    try {
      const marker: unknown = JSON.parse(raw);
      if (!isVaultMarker(marker)) throw new Error('Vault marker is invalid.');
      return marker;
    } catch (error) {
      throw new AppError({
        cause: error,
        code: 'vault-invalid',
        message: 'Vault marker is invalid.',
      });
    }
  }
}
