import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AppError } from '@tjournal/platform-errors';
import type {
  CreateInstrumentInput,
  Instrument,
  JournalStorage,
  VaultDescriptor,
  VaultStatus,
} from '@tjournal/journal';

import { SqliteVaultDatabase } from './sqlite-vault-database';

const ATTACHMENTS_DIRECTORY_NAME = 'attachments';
const BACKUPS_DIRECTORY_NAME = 'backups';
const DATABASE_FILE_NAME = 'journal.sqlite';
const MARKER_FILE_NAME = '.tjournal-vault.json';
const VAULT_FORMAT_VERSION = 1;

interface VaultMarker {
  readonly createdAt: string;
  readonly formatVersion: number;
  readonly vaultId: string;
}
interface InstrumentRow {
  readonly category: Instrument['category'];
  readonly created_at: string;
  readonly id: string;
  readonly source: Instrument['source'];
  readonly symbol: string;
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

  public createInstrument(input: CreateInstrumentInput & { readonly id: string }): Instrument {
    const instrument: Instrument = {
      ...input,
      createdAt: new Date().toISOString(),
      id: input.id,
      source: 'custom',
    };
    try {
      this.vaultDatabase
        .require()
        .prepare(
          'INSERT INTO instruments (id, symbol, category, source, created_at, updated_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
        )
        .run(
          instrument.id,
          instrument.symbol,
          instrument.category,
          instrument.source,
          instrument.createdAt,
          instrument.createdAt,
        );
      return instrument;
    } catch (error) {
      throw new AppError({
        cause: error,
        code: 'configuration-invalid',
        message: 'Instrument already exists.',
      });
    }
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
    return toDescriptor(vaultPath, marker);
  }

  public deleteInstrument(id: string): Instrument {
    const row = this.vaultDatabase
      .require()
      .prepare('SELECT id, symbol, category, source, created_at FROM instruments WHERE id = ?')
      .get(id) as InstrumentRow | undefined;
    if (row === undefined)
      throw new AppError({ code: 'vault-invalid', message: 'Instrument does not exist.' });
    this.vaultDatabase.require().prepare('DELETE FROM instruments WHERE id = ?').run(id);
    return this.mapInstrument(row);
  }

  public getStatus(): VaultStatus {
    return { isOpen: this.vaultDatabase.getPath() !== null, path: this.vaultDatabase.getPath() };
  }

  public listInstruments(): readonly Instrument[] {
    const rows = this.vaultDatabase
      .require()
      .prepare(
        'SELECT id, symbol, category, source, created_at FROM instruments ORDER BY symbol ASC',
      )
      .all() as unknown as readonly InstrumentRow[];
    return rows.map((row) => this.mapInstrument(row));
  }

  public openVault(vaultPath: string): VaultDescriptor {
    const marker = this.readMarker(vaultPath);
    this.openDatabase(vaultPath);
    this.checkIntegrity();
    return toDescriptor(vaultPath, marker);
  }

  private mapInstrument(row: InstrumentRow): Instrument {
    return {
      category: row.category,
      createdAt: row.created_at,
      id: row.id,
      source: row.source,
      symbol: row.symbol,
    };
  }

  private openDatabase(vaultPath: string): void {
    this.vaultDatabase.open(join(vaultPath, DATABASE_FILE_NAME), vaultPath);
    this.vaultDatabase.migrate();
  }

  private readMarker(vaultPath: string): VaultMarker {
    try {
      const marker: unknown = JSON.parse(readFileSync(markerFilePath(vaultPath), 'utf8'));
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
