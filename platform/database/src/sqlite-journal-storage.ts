import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { drizzle } from 'drizzle-orm/node-sqlite';

import { AppError } from '@tjournal/platform-errors';
import type {
  ClosedTrade,
  CreateInstrumentInput,
  CreateClosedTradeInput,
  Instrument,
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
const INSTRUMENTS_MIGRATION_ID = '002-instruments';

const SEED_INSTRUMENTS: readonly CreateInstrumentInput[] = [
  ...[
    'EURUSD',
    'GBPUSD',
    'USDJPY',
    'USDCHF',
    'AUDUSD',
    'USDCAD',
    'NZDUSD',
    'EURGBP',
    'EURJPY',
    'GBPJPY',
  ].map((symbol) => ({ category: 'forex' as const, symbol })),
  ...['XAUUSD', 'XAGUSD'].map((symbol) => ({ category: 'metal' as const, symbol })),
  ...['US500', 'US100', 'US30', 'GER40', 'UK100', 'JP225'].map((symbol) => ({
    category: 'index' as const,
    symbol,
  })),
  ...['WTI', 'BRENT', 'NATGAS'].map((symbol) => ({ category: 'energy' as const, symbol })),
  ...['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD'].map((symbol) => ({
    category: 'crypto' as const,
    symbol,
  })),
  ...['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL'].map((symbol) => ({
    category: 'equity' as const,
    symbol,
  })),
  ...['SPY', 'QQQ'].map((symbol) => ({ category: 'etf' as const, symbol })),
];

interface VaultMarker {
  readonly createdAt: string;
  readonly formatVersion: number;
  readonly vaultId: string;
}

interface TradeRow {
  readonly closed_at: string;
  readonly id: string;
  readonly instrument_id: string;
  readonly instrument_symbol: string;
  readonly result_kind: string;
  readonly result_value: string;
}

interface InstrumentRow {
  readonly category: Instrument['category'];
  readonly created_at: string;
  readonly id: string;
  readonly source: Instrument['source'];
  readonly symbol: string;
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
    const instrument = database
      .prepare('SELECT id, symbol FROM instruments WHERE id = ?')
      .get(input.instrumentId) as { readonly id: string; readonly symbol: string } | undefined;
    if (instrument === undefined) {
      throw new AppError({ code: 'vault-invalid', message: 'Trade instrument does not exist.' });
    }
    database
      .prepare(
        'INSERT INTO trades (id, instrument, instrument_id, closed_at, result_kind, result_value) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        input.id,
        instrument.symbol,
        input.instrumentId,
        input.closedAt,
        input.resultKind,
        input.resultValue,
      );

    return {
      closedAt: input.closedAt,
      id: input.id,
      instrumentId: input.instrumentId,
      instrumentSymbol: instrument.symbol,
      resultKind: input.resultKind,
      resultValue: input.resultValue,
    };
  }

  public createInstrument(input: CreateInstrumentInput & { readonly id: string }): Instrument {
    const database = this.requireDatabase();
    const instrument: Instrument = {
      category: input.category,
      createdAt: new Date().toISOString(),
      id: input.id,
      source: 'custom',
      symbol: input.symbol,
    };
    try {
      database
        .prepare(
          'INSERT INTO instruments (id, symbol, category, source, created_at) VALUES (?, ?, ?, ?, ?)',
        )
        .run(
          instrument.id,
          instrument.symbol,
          instrument.category,
          instrument.source,
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

  public deleteTrade(id: string): ClosedTrade {
    const trade = this.findTrade(id);
    this.requireDatabase().prepare('DELETE FROM trades WHERE id = ?').run(id);
    return trade;
  }

  public deleteInstrument(id: string): Instrument {
    const row = this.requireDatabase()
      .prepare('SELECT id, symbol, category, source, created_at FROM instruments WHERE id = ?')
      .get(id) as InstrumentRow | undefined;
    if (row === undefined)
      throw new AppError({ code: 'vault-invalid', message: 'Instrument does not exist.' });
    this.requireDatabase().prepare('DELETE FROM instruments WHERE id = ?').run(id);
    return {
      category: row.category,
      createdAt: row.created_at,
      id: row.id,
      source: row.source,
      symbol: row.symbol,
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
        `SELECT trades.id, trades.closed_at, trades.result_kind, trades.result_value,
          instruments.id AS instrument_id, instruments.symbol AS instrument_symbol
         FROM trades JOIN instruments ON instruments.id = trades.instrument_id
         ORDER BY trades.closed_at DESC`,
      )
      .all() as unknown as readonly TradeRow[];

    return rows.map((row) => ({
      closedAt: row.closed_at,
      id: row.id,
      instrumentId: row.instrument_id,
      instrumentSymbol: row.instrument_symbol,
      resultKind: row.result_kind === 'percent' ? 'percent' : 'cash',
      resultValue: row.result_value,
    }));
  }

  public listInstruments(): readonly Instrument[] {
    const rows = this.requireDatabase()
      .prepare(
        'SELECT id, symbol, category, source, created_at FROM instruments ORDER BY symbol ASC',
      )
      .all() as unknown as readonly InstrumentRow[];
    return rows.map((row) => ({
      category: row.category,
      createdAt: row.created_at,
      id: row.id,
      source: row.source,
      symbol: row.symbol,
    }));
  }

  public openVault(vaultPath: string): VaultDescriptor {
    const marker = this.readMarker(vaultPath);
    this.openDatabase(vaultPath);
    this.applyMigrations();
    this.checkIntegrity();

    return toDescriptor(vaultPath, marker);
  }

  public updateTrade(trade: ClosedTrade): ClosedTrade {
    const database = this.requireDatabase();
    const instrument = database
      .prepare('SELECT id, symbol FROM instruments WHERE id = ?')
      .get(trade.instrumentId) as { readonly id: string; readonly symbol: string } | undefined;
    if (instrument === undefined) {
      throw new AppError({ code: 'vault-invalid', message: 'Trade instrument does not exist.' });
    }
    database
      .prepare(
        'UPDATE trades SET instrument = ?, instrument_id = ?, closed_at = ?, result_kind = ?, result_value = ? WHERE id = ?',
      )
      .run(
        instrument.symbol,
        instrument.id,
        trade.closedAt,
        trade.resultKind,
        trade.resultValue,
        trade.id,
      );
    return { ...trade, instrumentSymbol: instrument.symbol };
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
      const instrumentsMigration = database
        .prepare('SELECT id FROM tjournal_migrations WHERE id = ?')
        .get(INSTRUMENTS_MIGRATION_ID);
      if (instrumentsMigration === undefined) {
        database.exec(`
          CREATE TABLE instruments (
            id TEXT PRIMARY KEY NOT NULL,
            symbol TEXT NOT NULL COLLATE NOCASE UNIQUE,
            category TEXT NOT NULL,
            source TEXT NOT NULL CHECK (source IN ('seed', 'custom')),
            created_at TEXT NOT NULL
          );
          ALTER TABLE trades ADD COLUMN instrument_id TEXT REFERENCES instruments(id);
        `);
        const legacySymbols = database
          .prepare('SELECT DISTINCT instrument FROM trades')
          .all() as unknown as readonly { readonly instrument: string }[];
        for (const legacy of legacySymbols) {
          const id = randomUUID();
          database
            .prepare(
              'INSERT INTO instruments (id, symbol, category, source, created_at) VALUES (?, ?, ?, ?, ?)',
            )
            .run(id, legacy.instrument, 'forex', 'custom', new Date().toISOString());
          database
            .prepare('UPDATE trades SET instrument_id = ? WHERE instrument = ?')
            .run(id, legacy.instrument);
        }
        for (const seed of SEED_INSTRUMENTS) {
          database
            .prepare(
              'INSERT OR IGNORE INTO instruments (id, symbol, category, source, created_at) VALUES (?, ?, ?, ?, ?)',
            )
            .run(randomUUID(), seed.symbol, seed.category, 'seed', new Date().toISOString());
        }
        database
          .prepare('INSERT INTO tjournal_migrations (id, applied_at) VALUES (?, ?)')
          .run(INSTRUMENTS_MIGRATION_ID, new Date().toISOString());
      }
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

  private findTrade(id: string): ClosedTrade {
    const row = this.requireDatabase()
      .prepare(
        `SELECT trades.id, trades.closed_at, trades.result_kind, trades.result_value,
          instruments.id AS instrument_id, instruments.symbol AS instrument_symbol
         FROM trades JOIN instruments ON instruments.id = trades.instrument_id WHERE trades.id = ?`,
      )
      .get(id) as TradeRow | undefined;
    if (row === undefined) {
      throw new AppError({ code: 'vault-invalid', message: 'Trade does not exist.' });
    }
    return {
      closedAt: row.closed_at,
      id: row.id,
      instrumentId: row.instrument_id,
      instrumentSymbol: row.instrument_symbol,
      resultKind: row.result_kind === 'percent' ? 'percent' : 'cash',
      resultValue: row.result_value,
    };
  }
}
