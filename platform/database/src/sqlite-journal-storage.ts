import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { drizzle } from 'drizzle-orm/node-sqlite';

import { AppError } from '@tjournal/platform-errors';
import type {
  ClosedTrade,
  CreateClosedTradeInput,
  JournalStorage,
  VaultDescriptor,
  VaultStatus,
} from '@tjournal/journal';

const ATTACHMENTS_DIRECTORY_NAME = 'attachments';
const BACKUPS_DIRECTORY_NAME = 'backups';
const DATABASE_FILE_NAME = 'journal.sqlite';
const MARKER_FILE_NAME = '.tjournal-vault.json';
const VAULT_FORMAT_VERSION = 1;
const INITIAL_MIGRATION_ID = '001-initial-journal-schema';

interface VaultMarker {
  readonly createdAt: string;
  readonly formatVersion: number;
  readonly vaultId: string;
}

interface TradeRow {
  readonly closed_at: string;
  readonly id: string;
  readonly instrument: string;
  readonly result_kind: string;
  readonly result_value: string;
}

const databaseFilePath = (vaultPath: string): string => join(vaultPath, DATABASE_FILE_NAME);
const markerFilePath = (vaultPath: string): string => join(vaultPath, MARKER_FILE_NAME);

const toDescriptor = (vaultPath: string, marker: VaultMarker): VaultDescriptor => ({
  createdAt: marker.createdAt,
  formatVersion: marker.formatVersion,
  path: vaultPath,
  vaultId: marker.vaultId,
});

const createMarker = (): VaultMarker => ({
  createdAt: new Date().toISOString(),
  formatVersion: VAULT_FORMAT_VERSION,
  vaultId: randomUUID(),
});

const isVaultMarker = (value: unknown): value is VaultMarker => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const marker = value as Record<string, unknown>;
  return (
    marker.formatVersion === VAULT_FORMAT_VERSION &&
    typeof marker.createdAt === 'string' &&
    typeof marker.vaultId === 'string'
  );
};

export class SqliteJournalStorage implements JournalStorage {
  private activeVaultPath: string | null = null;
  private database: DatabaseSync | null = null;
  private orm: ReturnType<typeof drizzle> | null = null;

  public checkIntegrity(): void {
    const database = this.requireDatabase();
    const result = database.prepare('PRAGMA integrity_check').get() as
      { integrity_check?: unknown } | undefined;

    if (result?.integrity_check !== 'ok') {
      throw new AppError({
        code: 'storage-integrity-failed',
        message: 'SQLite integrity check failed.',
      });
    }
  }

  public close(): void {
    if (this.database === null) {
      return;
    }

    this.database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    this.database.close();
    this.database = null;
    this.orm = null;
    this.activeVaultPath = null;
  }

  public createTrade(input: CreateClosedTradeInput & { readonly id: string }): ClosedTrade {
    const database = this.requireDatabase();
    database
      .prepare(
        'INSERT INTO trades (id, instrument, closed_at, result_kind, result_value) VALUES (?, ?, ?, ?, ?)',
      )
      .run(input.id, input.instrument, input.closedAt, input.resultKind, input.resultValue);

    return {
      closedAt: input.closedAt,
      id: input.id,
      instrument: input.instrument,
      resultKind: input.resultKind,
      resultValue: input.resultValue,
    };
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
    this.openDatabase(vaultPath);
    this.applyMigrations();

    return toDescriptor(vaultPath, marker);
  }

  public getStatus(): VaultStatus {
    return { isOpen: this.database !== null, path: this.activeVaultPath };
  }

  public listTrades(): readonly ClosedTrade[] {
    const database = this.requireDatabase();
    const rows = database
      .prepare(
        'SELECT id, instrument, closed_at, result_kind, result_value FROM trades ORDER BY closed_at DESC',
      )
      .all() as unknown as readonly TradeRow[];

    return rows.map((row) => ({
      closedAt: row.closed_at,
      id: row.id,
      instrument: row.instrument,
      resultKind: row.result_kind === 'percent' ? 'percent' : 'cash',
      resultValue: row.result_value,
    }));
  }

  public openVault(vaultPath: string): VaultDescriptor {
    const marker = this.readMarker(vaultPath);
    this.openDatabase(vaultPath);
    this.applyMigrations();
    this.checkIntegrity();

    return toDescriptor(vaultPath, marker);
  }

  private applyMigrations(): void {
    const database = this.requireDatabase();
    database.exec('BEGIN IMMEDIATE');

    try {
      database.exec(`
        CREATE TABLE IF NOT EXISTS tjournal_migrations (
          id TEXT PRIMARY KEY NOT NULL,
          applied_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS trades (
          id TEXT PRIMARY KEY NOT NULL,
          instrument TEXT NOT NULL,
          closed_at TEXT NOT NULL,
          result_kind TEXT NOT NULL CHECK (result_kind IN ('cash', 'percent')),
          result_value TEXT NOT NULL
        );
      `);
      database
        .prepare('INSERT OR IGNORE INTO tjournal_migrations (id, applied_at) VALUES (?, ?)')
        .run(INITIAL_MIGRATION_ID, new Date().toISOString());
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw new AppError({
        cause: error,
        code: 'vault-invalid',
        message: 'Vault migration failed.',
      });
    }
  }

  private openDatabase(vaultPath: string): void {
    this.close();
    this.database = new DatabaseSync(databaseFilePath(vaultPath));
    this.orm = drizzle({ client: this.database });
    this.database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.activeVaultPath = vaultPath;
  }

  private readMarker(vaultPath: string): VaultMarker {
    try {
      const marker: unknown = JSON.parse(readFileSync(markerFilePath(vaultPath), 'utf8'));
      if (!isVaultMarker(marker)) {
        throw new Error('Vault marker is invalid.');
      }

      return marker;
    } catch (error) {
      throw new AppError({
        code: 'vault-invalid',
        message: 'Vault marker is invalid.',
        cause: error,
      });
    }
  }

  private requireDatabase(): DatabaseSync {
    if (this.orm === null) {
      throw new AppError({
        code: 'vault-not-accessible',
        message: 'No active vault is open.',
        retryable: true,
      });
    }

    return this.orm.$client;
  }
}
