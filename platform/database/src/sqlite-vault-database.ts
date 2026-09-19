import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { AppError } from '@tjournal/platform-errors';

const MIGRATIONS_TABLE = 'tjournal_migrations';
const INITIAL_MIGRATION_ID = '001-initial-journal-schema';
const INSTRUMENTS_MIGRATION_ID = '002-instruments';
const EXTENDED_TRADES_MIGRATION_ID = '003-extended-trades';
const NEUTRAL_COST_SETTINGS_MIGRATION_ID = '004-neutral-cost-settings';
const DATA_REVISIONS_MIGRATION_ID = '005-data-revisions';
const ACCOUNTS_ASSETS_MIGRATION_ID = '006-accounts-assets';
const CASH_MOVEMENTS_MIGRATION_ID = '007-cash-movements';
const VAULT_PREFERENCES_ID = 'vault';

const SEED_INSTRUMENTS = [
  ['EURUSD', 'forex'],
  ['GBPUSD', 'forex'],
  ['USDJPY', 'forex'],
  ['USDCHF', 'forex'],
  ['AUDUSD', 'forex'],
  ['USDCAD', 'forex'],
  ['NZDUSD', 'forex'],
  ['EURGBP', 'forex'],
  ['EURJPY', 'forex'],
  ['GBPJPY', 'forex'],
  ['XAUUSD', 'metal'],
  ['XAGUSD', 'metal'],
  ['US500', 'index'],
  ['US100', 'index'],
  ['US30', 'index'],
  ['GER40', 'index'],
  ['UK100', 'index'],
  ['JP225', 'index'],
  ['WTI', 'energy'],
  ['BRENT', 'energy'],
  ['NATGAS', 'energy'],
  ['BTCUSD', 'crypto'],
  ['ETHUSD', 'crypto'],
  ['SOLUSD', 'crypto'],
  ['XRPUSD', 'crypto'],
  ['AAPL', 'equity'],
  ['MSFT', 'equity'],
  ['NVDA', 'equity'],
  ['TSLA', 'equity'],
  ['AMZN', 'equity'],
  ['META', 'equity'],
  ['GOOGL', 'equity'],
  ['SPY', 'etf'],
  ['QQQ', 'etf'],
] as const;

export class SqliteVaultDatabase {
  private database: DatabaseSync | null = null;
  private databasePath: string | null = null;
  private readOnly = false;
  private vaultPath: string | null = null;

  public close(): void {
    if (this.database === null) return;
    if (!this.readOnly) this.database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    this.database.close();
    this.database = null;
    this.databasePath = null;
    this.readOnly = false;
    this.vaultPath = null;
  }

  public getPath(): string | null {
    return this.vaultPath;
  }

  public getDatabasePath(): string | null {
    return this.databasePath;
  }

  public open(databasePath: string, vaultPath: string): void {
    this.close();
    this.database = new DatabaseSync(databasePath, { timeout: 5000 });
    this.database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.databasePath = databasePath;
    this.readOnly = false;
    this.vaultPath = vaultPath;
  }

  public openReadOnly(databasePath: string): void {
    this.close();
    this.database = new DatabaseSync(databasePath, { readOnly: true, timeout: 5000 });
    this.database.exec('PRAGMA foreign_keys = ON; PRAGMA query_only = ON;');
    this.databasePath = databasePath;
    this.readOnly = true;
    this.vaultPath = null;
  }

  public require(): DatabaseSync {
    if (this.database === null) {
      throw new AppError({
        code: 'vault-not-accessible',
        message: 'No active vault is open.',
        retryable: true,
      });
    }
    return this.database;
  }

  public transaction<T>(operation: () => T): T {
    const database = this.require();
    database.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      database.exec('COMMIT');
      return result;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  public migrate(): void {
    try {
      this.transaction(() => {
        const database = this.require();
        database.exec(`
          CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS trades (
            id TEXT PRIMARY KEY NOT NULL,
            instrument TEXT NOT NULL,
            closed_at TEXT NOT NULL,
            result_kind TEXT NOT NULL CHECK (result_kind IN ('cash', 'percent')),
            result_value TEXT NOT NULL
          );
        `);
        this.recordMigration(INITIAL_MIGRATION_ID);
        if (!this.hasMigration(INSTRUMENTS_MIGRATION_ID)) this.migrateInstruments();
        if (!this.hasMigration(EXTENDED_TRADES_MIGRATION_ID)) this.migrateExtendedTrades();
        if (!this.hasMigration(NEUTRAL_COST_SETTINGS_MIGRATION_ID))
          this.migrateNeutralCostSettings();
        if (!this.hasMigration(DATA_REVISIONS_MIGRATION_ID)) this.migrateDataRevisions();
        if (!this.hasMigration(ACCOUNTS_ASSETS_MIGRATION_ID)) this.migrateAccountsAssets();
        if (!this.hasMigration(CASH_MOVEMENTS_MIGRATION_ID)) this.migrateCashMovements();
        this.ensureAccountAttributionColumns();
        this.ensureAccountAttributionIntegrityTriggers();
      });
    } catch (error) {
      throw new AppError({
        cause: error,
        code: 'vault-invalid',
        message: 'Vault migration failed.',
      });
    }
  }

  public getDataRevisions(): Readonly<Record<string, number>> {
    const rows = this.require()
      .prepare('SELECT resource, revision FROM data_revisions ORDER BY resource')
      .all() as unknown as readonly { resource: string; revision: number }[];
    return Object.fromEntries(rows.map((row) => [row.resource, row.revision]));
  }

  private hasMigration(id: string): boolean {
    return (
      this.require().prepare(`SELECT id FROM ${MIGRATIONS_TABLE} WHERE id = ?`).get(id) !==
      undefined
    );
  }

  private recordMigration(id: string): void {
    this.require()
      .prepare(`INSERT OR IGNORE INTO ${MIGRATIONS_TABLE} (id, applied_at) VALUES (?, ?)`)
      .run(id, new Date().toISOString());
  }

  private hasColumn(table: string, column: string): boolean {
    const columns = this.require()
      .prepare(`PRAGMA table_info(${table})`)
      .all() as unknown as readonly {
      readonly name: string;
    }[];
    return columns.some((item) => item.name === column);
  }

  private addColumnIfMissing(table: string, column: string, definition: string): void {
    if (!this.hasColumn(table, column))
      this.require().exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }

  /** Repairs an interrupted pre-release migration without changing existing trade snapshots. */
  private ensureAccountAttributionColumns(): void {
    this.addColumnIfMissing('accounts', 'default_risk_usd', 'default_risk_usd TEXT');
    this.addColumnIfMissing('instruments', 'updated_at', 'updated_at TEXT');
    this.addColumnIfMissing('instruments', 'archived_at', 'archived_at TEXT');
    this.require().exec('UPDATE instruments SET updated_at = created_at WHERE updated_at IS NULL');
    this.addColumnIfMissing('trades', 'account_id', 'account_id TEXT REFERENCES accounts(id)');
    this.addColumnIfMissing('trades', 'account_name_snapshot', 'account_name_snapshot TEXT');
    this.addColumnIfMissing(
      'trades',
      'account_balance_before_usd',
      'account_balance_before_usd TEXT',
    );
    this.addColumnIfMissing(
      'trades',
      'account_balance_impact_usd',
      'account_balance_impact_usd TEXT',
    );
    this.addColumnIfMissing(
      'trades',
      'account_balance_conversion',
      'account_balance_conversion TEXT',
    );
    this.addColumnIfMissing('trades', 'input_result_kind', 'input_result_kind TEXT');
    this.addColumnIfMissing('trades', 'input_result_value', 'input_result_value TEXT');
    this.addColumnIfMissing('trades', 'net_result_usd', 'net_result_usd TEXT');
    this.addColumnIfMissing(
      'trades',
      'account_conversion_balance_usd',
      'account_conversion_balance_usd TEXT',
    );
    this.addColumnIfMissing('trades', 'account_initial_risk_usd', 'account_initial_risk_usd TEXT');
  }

  /**
   * SQLite trigger predicates must address the row being inserted through NEW.
   * Recreating the triggers also repairs vaults opened with the early FND-012 trigger form.
   */
  private ensureAccountAttributionIntegrityTriggers(): void {
    this.require().exec(`
      DROP TRIGGER IF EXISTS trades_account_snapshot_integrity_insert;
      DROP TRIGGER IF EXISTS trades_account_snapshot_integrity_update;
      CREATE TRIGGER trades_account_snapshot_integrity_insert
        BEFORE INSERT ON trades
        WHEN (NEW.account_id IS NULL AND (NEW.account_name_snapshot IS NOT NULL OR NEW.account_balance_before_usd IS NOT NULL OR NEW.account_balance_impact_usd IS NOT NULL OR NEW.account_balance_conversion IS NOT NULL))
          OR (NEW.account_id IS NOT NULL AND (NEW.account_name_snapshot IS NULL OR NEW.account_balance_before_usd IS NULL))
        BEGIN SELECT RAISE(ABORT, 'incomplete account attribution snapshot'); END;
      CREATE TRIGGER trades_account_snapshot_integrity_update
        BEFORE UPDATE OF account_id, account_name_snapshot, account_balance_before_usd, account_balance_impact_usd, account_balance_conversion ON trades
        WHEN (NEW.account_id IS NULL AND (NEW.account_name_snapshot IS NOT NULL OR NEW.account_balance_before_usd IS NOT NULL OR NEW.account_balance_impact_usd IS NOT NULL OR NEW.account_balance_conversion IS NOT NULL))
          OR (NEW.account_id IS NOT NULL AND (NEW.account_name_snapshot IS NULL OR NEW.account_balance_before_usd IS NULL))
        BEGIN SELECT RAISE(ABORT, 'incomplete account attribution snapshot'); END;
    `);
  }

  private migrateInstruments(): void {
    const database = this.require();
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
    const insert = database.prepare(
      'INSERT INTO instruments (id, symbol, category, source, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    for (const legacy of legacySymbols) {
      const id = randomUUID();
      insert.run(id, legacy.instrument, 'forex', 'custom', new Date().toISOString());
      database
        .prepare('UPDATE trades SET instrument_id = ? WHERE instrument = ?')
        .run(id, legacy.instrument);
    }
    const insertSeed = database.prepare(
      'INSERT OR IGNORE INTO instruments (id, symbol, category, source, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    for (const [symbol, category] of SEED_INSTRUMENTS) {
      insertSeed.run(randomUUID(), symbol, category, 'seed', new Date().toISOString());
    }
    this.recordMigration(INSTRUMENTS_MIGRATION_ID);
  }

  private migrateExtendedTrades(): void {
    const database = this.require();
    database.exec(`
      CREATE TABLE trades_v3 (
        id TEXT PRIMARY KEY NOT NULL,
        instrument TEXT NOT NULL,
        instrument_id TEXT NOT NULL REFERENCES instruments(id),
        closed_at TEXT NOT NULL,
        direction TEXT CHECK (direction IN ('long', 'short')),
        result_kind TEXT NOT NULL CHECK (result_kind IN ('cash', 'percent', 'r')),
        result_value TEXT NOT NULL,
        result_source TEXT NOT NULL CHECK (result_source IN ('manual', 'calculated')),
        risk_binding_kind TEXT CHECK (risk_binding_kind IN ('cash', 'percent')),
        risk_binding_value TEXT,
        entry_price TEXT,
        stop_loss_price TEXT,
        quantity_lots TEXT,
        commission_usd TEXT,
        spread_ticks TEXT,
        snapshot_tick_size TEXT,
        snapshot_tick_value_usd_per_lot TEXT
      );
      INSERT INTO trades_v3 (
        id, instrument, instrument_id, closed_at, direction, result_kind, result_value, result_source
      ) SELECT id, instrument, instrument_id, closed_at, NULL, result_kind, result_value, 'manual' FROM trades;
      DROP TABLE trades;
      ALTER TABLE trades_v3 RENAME TO trades;
      CREATE TABLE trade_exits (
        id TEXT PRIMARY KEY NOT NULL,
        trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
        exit_order INTEGER NOT NULL,
        exit_price TEXT NOT NULL,
        allocation_kind TEXT NOT NULL CHECK (allocation_kind IN ('percent', 'lots')),
        allocation_value TEXT NOT NULL,
        reported_result_kind TEXT CHECK (reported_result_kind IN ('cash', 'percent')),
        reported_result_value TEXT
      );
      CREATE TABLE instrument_calculation_profiles (
        instrument_id TEXT PRIMARY KEY NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
        tick_size TEXT NOT NULL,
        tick_value_usd_per_lot TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE trade_preferences (
        id TEXT PRIMARY KEY NOT NULL,
        risk_binding_kind TEXT CHECK (risk_binding_kind IN ('cash', 'percent')),
        risk_binding_value TEXT,
        risk_prompt_dismissed INTEGER NOT NULL DEFAULT 0,
        neutral_cash_lower TEXT,
        neutral_cash_upper TEXT,
        neutral_percent_lower TEXT,
        neutral_percent_upper TEXT,
        neutral_r_lower TEXT,
        neutral_r_upper TEXT
      );
    `);
    database.prepare('INSERT INTO trade_preferences (id) VALUES (?)').run(VAULT_PREFERENCES_ID);
    this.recordMigration(EXTENDED_TRADES_MIGRATION_ID);
  }

  private migrateNeutralCostSettings(): void {
    this.require().exec(`
      ALTER TABLE trade_preferences ADD COLUMN neutral_include_commission INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE trade_preferences ADD COLUMN neutral_include_spread INTEGER NOT NULL DEFAULT 0;
    `);
    this.recordMigration(NEUTRAL_COST_SETTINGS_MIGRATION_ID);
  }

  private migrateDataRevisions(): void {
    const database = this.require();
    database.exec(`
      CREATE TABLE data_revisions (
        resource TEXT PRIMARY KEY NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO data_revisions (resource, revision) VALUES
        ('trades', 0),
        ('instruments', 0),
        ('trade-preferences', 0),
        ('instrument-profiles', 0);

      CREATE INDEX IF NOT EXISTS trades_closed_at_idx ON trades (closed_at, id);
      CREATE INDEX IF NOT EXISTS trades_instrument_closed_at_idx
        ON trades (instrument_id, closed_at, id);
      CREATE INDEX IF NOT EXISTS trades_result_kind_closed_at_idx
        ON trades (result_kind, closed_at, id);
      CREATE INDEX IF NOT EXISTS trade_exits_trade_order_idx
        ON trade_exits (trade_id, exit_order);

      CREATE TRIGGER trades_revision_after_insert
        AFTER INSERT ON trades
        BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'trades';
        END;
      CREATE TRIGGER trades_revision_after_update
        AFTER UPDATE ON trades
        BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'trades';
        END;
      CREATE TRIGGER trades_revision_after_delete
        AFTER DELETE ON trades
        BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'trades';
        END;
      CREATE TRIGGER trade_exits_revision_after_insert
        AFTER INSERT ON trade_exits
        BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'trades';
        END;
      CREATE TRIGGER trade_exits_revision_after_update
        AFTER UPDATE ON trade_exits
        BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'trades';
        END;
      CREATE TRIGGER trade_exits_revision_after_delete
        AFTER DELETE ON trade_exits
        BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'trades';
        END;
      CREATE TRIGGER instruments_revision_after_insert
        AFTER INSERT ON instruments
        BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'instruments';
        END;
      CREATE TRIGGER instruments_revision_after_update
        AFTER UPDATE ON instruments
        BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'instruments';
        END;
      CREATE TRIGGER instruments_revision_after_delete
        AFTER DELETE ON instruments
        BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'instruments';
        END;
      CREATE TRIGGER trade_preferences_revision_after_insert
        AFTER INSERT ON trade_preferences
        BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'trade-preferences';
        END;
      CREATE TRIGGER trade_preferences_revision_after_update
        AFTER UPDATE ON trade_preferences
        BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'trade-preferences';
        END;
      CREATE TRIGGER trade_preferences_revision_after_delete
        AFTER DELETE ON trade_preferences
        BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'trade-preferences';
        END;
      CREATE TRIGGER instrument_profiles_revision_after_insert
        AFTER INSERT ON instrument_calculation_profiles
        BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'instrument-profiles';
        END;
      CREATE TRIGGER instrument_profiles_revision_after_update
        AFTER UPDATE ON instrument_calculation_profiles
        BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'instrument-profiles';
        END;
      CREATE TRIGGER instrument_profiles_revision_after_delete
        AFTER DELETE ON instrument_calculation_profiles
        BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'instrument-profiles';
        END;
    `);
    this.recordMigration(DATA_REVISIONS_MIGRATION_ID);
  }

  private migrateAccountsAssets(): void {
    const database = this.require();
    database.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        opening_balance_usd TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
      );
      CREATE TABLE IF NOT EXISTS account_instrument_defaults (
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        instrument_id TEXT NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
        commission_usd TEXT NOT NULL,
        spread_ticks TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (account_id, instrument_id)
      );
    `);
    this.ensureAccountAttributionColumns();
    database.exec(`
      CREATE INDEX accounts_name_idx ON accounts (name);
      CREATE INDEX accounts_active_idx ON accounts (archived_at, name);
      CREATE INDEX account_defaults_instrument_idx ON account_instrument_defaults (instrument_id);
      CREATE INDEX trades_account_closed_at_idx ON trades (account_id, closed_at, id);
      CREATE TRIGGER trades_account_snapshot_integrity_insert
        BEFORE INSERT ON trades
        WHEN (account_id IS NULL AND (account_name_snapshot IS NOT NULL OR account_balance_before_usd IS NOT NULL OR account_balance_impact_usd IS NOT NULL OR account_balance_conversion IS NOT NULL))
          OR (account_id IS NOT NULL AND (account_name_snapshot IS NULL OR account_balance_before_usd IS NULL))
        BEGIN SELECT RAISE(ABORT, 'incomplete account attribution snapshot'); END;
      CREATE TRIGGER trades_account_snapshot_integrity_update
        BEFORE UPDATE OF account_id, account_name_snapshot, account_balance_before_usd, account_balance_impact_usd, account_balance_conversion ON trades
        WHEN (account_id IS NULL AND (account_name_snapshot IS NOT NULL OR account_balance_before_usd IS NOT NULL OR account_balance_impact_usd IS NOT NULL OR account_balance_conversion IS NOT NULL))
          OR (account_id IS NOT NULL AND (account_name_snapshot IS NULL OR account_balance_before_usd IS NULL))
        BEGIN SELECT RAISE(ABORT, 'incomplete account attribution snapshot'); END;
    `);
    database
      .prepare(`INSERT OR IGNORE INTO data_revisions (resource, revision) VALUES (?, 0), (?, 0)`)
      .run('accounts', 'account-instrument-defaults');
    database.exec(`
      CREATE TRIGGER accounts_revision_after_insert
        AFTER INSERT ON accounts BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'accounts';
        END;
      CREATE TRIGGER accounts_revision_after_update
        AFTER UPDATE ON accounts BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'accounts';
        END;
      CREATE TRIGGER accounts_revision_after_delete
        AFTER DELETE ON accounts BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'accounts';
        END;
      CREATE TRIGGER account_defaults_revision_after_insert
        AFTER INSERT ON account_instrument_defaults BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'account-instrument-defaults';
        END;
      CREATE TRIGGER account_defaults_revision_after_update
        AFTER UPDATE ON account_instrument_defaults BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'account-instrument-defaults';
        END;
      CREATE TRIGGER account_defaults_revision_after_delete
        AFTER DELETE ON account_instrument_defaults BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'account-instrument-defaults';
        END;
    `);
    this.recordMigration(ACCOUNTS_ASSETS_MIGRATION_ID);
  }

  private migrateCashMovements(): void {
    const database = this.require();
    database.exec(`
      CREATE TABLE cash_movements (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id),
        account_name_snapshot TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('deposit', 'withdrawal')),
        amount_usd TEXT NOT NULL
      );
      CREATE INDEX cash_movements_account_occurred_at_idx
        ON cash_movements (account_id, occurred_at, id);
      CREATE INDEX cash_movements_occurred_at_idx
        ON cash_movements (occurred_at, id);
    `);
    database
      .prepare(`INSERT OR IGNORE INTO data_revisions (resource, revision) VALUES (?, 0)`)
      .run('cash-movements');
    database.exec(`
      CREATE TRIGGER cash_movements_revision_after_insert
        AFTER INSERT ON cash_movements BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'cash-movements';
        END;
      CREATE TRIGGER cash_movements_revision_after_update
        AFTER UPDATE ON cash_movements BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'cash-movements';
        END;
      CREATE TRIGGER cash_movements_revision_after_delete
        AFTER DELETE ON cash_movements BEGIN
          UPDATE data_revisions SET revision = revision + 1 WHERE resource = 'cash-movements';
        END;
    `);
    this.recordMigration(CASH_MOVEMENTS_MIGRATION_ID);
  }
}
