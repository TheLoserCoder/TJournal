import Decimal from 'decimal.js';

import type {
  CreateInstrumentInput,
  Instrument,
  InstrumentCalculationProfile,
  InstrumentStore,
  UpdateInstrumentInput,
} from '@tjournal/instrument';
import { AppError } from '@tjournal/platform-errors';

import { SqliteVaultDatabase } from './sqlite-vault-database';

interface InstrumentRow {
  readonly category: Instrument['category'];
  readonly created_at: string;
  readonly id: string;
  readonly source: Instrument['source'];
  readonly symbol: string;
  readonly updated_at: string;
  readonly archived_at: string | null;
  readonly tick_size: string | null;
  readonly tick_value_usd_per_lot: string | null;
  readonly profile_updated_at: string | null;
}

export class SqliteInstrumentStore implements InstrumentStore {
  public constructor(private readonly vaultDatabase: SqliteVaultDatabase) {}

  public archiveInstrument(id: string): Instrument {
    return this.setArchived(id, new Date().toISOString());
  }

  public createInstrument(input: CreateInstrumentInput & { readonly id: string }): Instrument {
    const now = new Date().toISOString();
    try {
      this.vaultDatabase.transaction(() => {
        this.vaultDatabase
          .require()
          .prepare(
            'INSERT INTO instruments (id, symbol, category, source, created_at, updated_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
          )
          .run(input.id, input.symbol, input.category, 'custom', now, now);
        this.saveProfile(input.id, input.calculationProfile ?? null, now);
      });
    } catch (error) {
      throw new AppError({
        cause: error,
        code: 'configuration-invalid',
        message: 'Instrument already exists or is invalid.',
      });
    }
    return this.require(input.id);
  }

  public deleteInstrument(id: string): Instrument {
    const instrument = this.require(id);
    const row = this.vaultDatabase
      .require()
      .prepare('SELECT COUNT(*) AS count FROM trades WHERE instrument_id = ?')
      .get(id) as { count: number };
    if (row.count > 0) return this.setArchived(id, new Date().toISOString());
    this.vaultDatabase.require().prepare('DELETE FROM instruments WHERE id = ?').run(id);
    return instrument;
  }

  public listInstruments(): readonly Instrument[] {
    const rows = this.vaultDatabase
      .require()
      .prepare(
        `SELECT instruments.category, instruments.created_at, instruments.id, instruments.source,
        instruments.symbol, instruments.updated_at, instruments.archived_at,
        profiles.tick_size, profiles.tick_value_usd_per_lot, profiles.updated_at AS profile_updated_at
       FROM instruments LEFT JOIN instrument_calculation_profiles profiles ON profiles.instrument_id = instruments.id
       ORDER BY instruments.archived_at IS NOT NULL, instruments.symbol`,
      )
      .all() as unknown as readonly InstrumentRow[];
    return rows.map((row) => this.map(row));
  }

  public restoreArchivedInstrument(id: string): Instrument {
    return this.setArchived(id, null);
  }

  public updateInstrument(input: UpdateInstrumentInput): Instrument {
    this.require(input.id);
    const now = new Date().toISOString();
    try {
      this.vaultDatabase.transaction(() => {
        this.vaultDatabase
          .require()
          .prepare('UPDATE instruments SET symbol = ?, category = ?, updated_at = ? WHERE id = ?')
          .run(input.symbol, input.category, now, input.id);
        this.saveProfile(input.id, input.calculationProfile ?? null, now);
      });
    } catch (error) {
      throw new AppError({
        cause: error,
        code: 'configuration-invalid',
        message: 'Instrument already exists or is invalid.',
      });
    }
    return this.require(input.id);
  }

  private map(row: InstrumentRow): Instrument {
    const profile: InstrumentCalculationProfile | null =
      row.tick_size === null ||
      row.tick_value_usd_per_lot === null ||
      row.profile_updated_at === null
        ? null
        : {
            instrumentId: row.id,
            tickSize: row.tick_size,
            tickValueUsdPerLot: row.tick_value_usd_per_lot,
            updatedAt: row.profile_updated_at,
          };
    return {
      archivedAt: row.archived_at,
      calculationProfile: profile,
      category: row.category,
      createdAt: row.created_at,
      id: row.id,
      source: row.source,
      symbol: row.symbol,
      updatedAt: row.updated_at,
    };
  }

  private require(id: string): Instrument {
    const row = this.vaultDatabase
      .require()
      .prepare(
        `SELECT instruments.category, instruments.created_at, instruments.id, instruments.source,
        instruments.symbol, instruments.updated_at, instruments.archived_at,
        profiles.tick_size, profiles.tick_value_usd_per_lot, profiles.updated_at AS profile_updated_at
       FROM instruments LEFT JOIN instrument_calculation_profiles profiles ON profiles.instrument_id = instruments.id
       WHERE instruments.id = ?`,
      )
      .get(id) as InstrumentRow | undefined;
    if (row === undefined)
      throw new AppError({ code: 'vault-invalid', message: 'Instrument does not exist.' });
    return this.map(row);
  }

  private saveProfile(
    instrumentId: string,
    profile: CreateInstrumentInput['calculationProfile'],
    updatedAt: string,
  ): void {
    const database = this.vaultDatabase.require();
    database
      .prepare('DELETE FROM instrument_calculation_profiles WHERE instrument_id = ?')
      .run(instrumentId);
    if (profile !== null && profile !== undefined) {
      database
        .prepare(
          'INSERT INTO instrument_calculation_profiles (instrument_id, tick_size, tick_value_usd_per_lot, updated_at) VALUES (?, ?, ?, ?)',
        )
        .run(
          instrumentId,
          new Decimal(profile.tickSize).toFixed(),
          new Decimal(profile.tickValueUsdPerLot).toFixed(),
          updatedAt,
        );
    }
  }

  private setArchived(id: string, archivedAt: string | null): Instrument {
    this.require(id);
    this.vaultDatabase
      .require()
      .prepare('UPDATE instruments SET archived_at = ?, updated_at = ? WHERE id = ?')
      .run(archivedAt, new Date().toISOString(), id);
    return this.require(id);
  }
}
