import Decimal from 'decimal.js';

import { CASH_MOVEMENT_KINDS } from '@tjournal/account';
import type {
  AccountBalance,
  AccountInstrumentDefaults,
  AccountInstrumentDefaultWrite,
  AccountStore,
  CashMovement,
  CashMovementKind,
  CreateCashMovementInput,
  CreateTradingAccountInput,
  TradingAccount,
  UpdateCashMovementInput,
  UpdateTradingAccountInput,
} from '@tjournal/account';
import { AppError } from '@tjournal/platform-errors';

import { SqliteVaultDatabase } from './sqlite-vault-database';

interface AccountRow {
  readonly id: string;
  readonly name: string;
  readonly opening_balance_usd: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly archived_at: string | null;
  readonly default_risk_usd: string | null;
}

interface DefaultsRow {
  readonly account_id: string;
  readonly instrument_id: string;
  readonly commission_usd: string;
  readonly spread_ticks: string;
  readonly tick_size: string | null;
  readonly tick_value_usd_per_lot: string | null;
  readonly updated_at: string;
}

const toAccountDefault = (row: DefaultsRow): AccountInstrumentDefaults => ({
  accountId: row.account_id,
  commissionUsd: row.commission_usd,
  instrumentId: row.instrument_id,
  spreadTicks: row.spread_ticks,
  tickSize: row.tick_size,
  tickValueUsdPerLot: row.tick_value_usd_per_lot,
  updatedAt: row.updated_at,
});

interface CashMovementRow {
  readonly account_id: string;
  readonly account_name_snapshot: string;
  readonly amount_usd: string;
  readonly id: string;
  readonly occurred_at: string;
  readonly kind: CashMovementKind;
}

const toAccount = (row: AccountRow): TradingAccount => ({
  archivedAt: row.archived_at,
  createdAt: row.created_at,
  defaultRiskUsd: row.default_risk_usd,
  id: row.id,
  name: row.name,
  openingBalanceUsd: row.opening_balance_usd,
  updatedAt: row.updated_at,
});

export class SqliteAccountStore implements AccountStore {
  public constructor(private readonly vaultDatabase: SqliteVaultDatabase) {}

  public archiveAccount(id: string): TradingAccount {
    return this.setArchived(id, new Date().toISOString());
  }

  public createCashMovement(
    input: { readonly id: string } & CreateCashMovementInput,
  ): CashMovement {
    const account = this.requireAccount(input.accountId);
    if (account.archivedAt !== null) {
      throw new AppError({
        code: 'validation-invalid',
        issues: [{ code: 'archived-account', path: 'accountId' }],
        message: 'Archived accounts cannot receive cash movements.',
      });
    }
    this.vaultDatabase.transaction(() => {
      this.validateMovement(input.kind, input.amountUsd, input.accountId);
      this.vaultDatabase
        .require()
        .prepare(
          'INSERT INTO cash_movements (id, account_id, account_name_snapshot, occurred_at, kind, amount_usd) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(
          input.id,
          account.id,
          account.name,
          input.occurredAt,
          input.kind,
          new Decimal(input.amountUsd).toFixed(),
        );
    });
    const movement = this.getCashMovement(input.id);
    if (movement === null) throw new Error('Cash movement was not created.');
    return movement;
  }

  public createAccount(input: CreateTradingAccountInput & { readonly id: string }): TradingAccount {
    const now = new Date().toISOString();
    try {
      this.vaultDatabase.transaction(() => {
        this.vaultDatabase
          .require()
          .prepare(
            'INSERT INTO accounts (id, name, opening_balance_usd, created_at, updated_at, archived_at, default_risk_usd) VALUES (?, ?, ?, ?, ?, NULL, ?)',
          )
          .run(
            input.id,
            input.name,
            new Decimal(input.openingBalanceUsd).toFixed(),
            now,
            now,
            input.defaultRiskUsd ?? null,
          );
        if (input.defaults !== undefined) {
          this.saveDefaults(
            input.id,
            input.defaults.map((item) => ({ ...item, accountId: input.id, updatedAt: now })),
          );
        }
      });
      const account = this.getAccountById(input.id);
      if (account === null) throw new Error('Account was not created.');
      return account;
    } catch (error) {
      // Infrastructure errors (for example a missing vault) must keep their own
      // code; only genuine account conflicts are reported as invalid configuration.
      if (error instanceof AppError) throw error;
      throw new AppError({
        cause: error,
        code: 'configuration-invalid',
        message: 'Account already exists or is invalid.',
      });
    }
  }

  public deleteAccount(id: string): TradingAccount {
    const account = this.requireAccount(id);
    const references = this.vaultDatabase
      .require()
      .prepare('SELECT COUNT(*) AS count FROM trades WHERE account_id = ?')
      .get(id) as { count: number };
    if (references.count > 0) return this.setArchived(id, new Date().toISOString());
    const movementReferences = this.vaultDatabase
      .require()
      .prepare('SELECT COUNT(*) AS count FROM cash_movements WHERE account_id = ?')
      .get(id) as { count: number };
    if (movementReferences.count > 0) return this.setArchived(id, new Date().toISOString());
    this.vaultDatabase.require().prepare('DELETE FROM accounts WHERE id = ?').run(id);
    return account;
  }

  public getAccountBalance(
    accountId: string,
    excludedTradeId?: string,
    excludedCashMovementId?: string,
  ): AccountBalance {
    const account = this.requireAccount(accountId);
    const impacts = this.vaultDatabase
      .require()
      .prepare(
        'SELECT account_balance_impact_usd FROM trades WHERE account_id = ? AND account_balance_impact_usd IS NOT NULL AND (? IS NULL OR id <> ?)',
      )
      .all(accountId, excludedTradeId ?? null, excludedTradeId ?? null) as unknown as readonly {
      account_balance_impact_usd: string;
    }[];
    const uncovered = this.vaultDatabase
      .require()
      .prepare(
        'SELECT COUNT(*) AS count FROM trades WHERE account_id = ? AND account_balance_impact_usd IS NULL AND (? IS NULL OR id <> ?)',
      )
      .get(accountId, excludedTradeId ?? null, excludedTradeId ?? null) as { count: number };
    const knownImpact = impacts.reduce(
      (sum, item) => sum.plus(item.account_balance_impact_usd),
      new Decimal(0),
    );
    const movements = this.vaultDatabase
      .require()
      .prepare(
        `SELECT kind, amount_usd FROM cash_movements
         WHERE account_id = ? AND (? IS NULL OR id <> ?)`,
      )
      .all(
        accountId,
        excludedCashMovementId ?? null,
        excludedCashMovementId ?? null,
      ) as unknown as readonly {
      kind: CashMovementKind;
      amount_usd: string;
    }[];
    const cashImpact = movements.reduce(
      (sum, movement) =>
        movement.kind === CASH_MOVEMENT_KINDS.deposit
          ? sum.plus(movement.amount_usd)
          : sum.minus(movement.amount_usd),
      new Decimal(0),
    );
    return {
      accountId,
      currentKnownBalanceUsd: new Decimal(account.openingBalanceUsd)
        .plus(knownImpact)
        .plus(cashImpact)
        .toFixed(),
      openingBalanceUsd: account.openingBalanceUsd,
      uncoveredTradeCount: Number(uncovered.count ?? 0),
    };
  }

  public getAccountBalanceContext(
    accountId: string,
    excludedTradeId?: string,
    allowArchived = false,
  ): {
    readonly accountId: string;
    readonly accountName: string;
    readonly balanceBeforeUsd: string;
    readonly defaultRiskUsd: string | null;
  } {
    const account = this.requireAccount(accountId);
    if (!allowArchived && account.archivedAt !== null)
      throw new AppError({
        code: 'validation-invalid',
        message: 'Archived accounts cannot be assigned to new trades.',
      });
    const balance = this.getAccountBalance(accountId, excludedTradeId);
    return {
      accountId,
      accountName: account.name,
      balanceBeforeUsd: balance.currentKnownBalanceUsd,
      defaultRiskUsd: account.defaultRiskUsd,
    };
  }

  public saveAccountRiskUsd(accountId: string, riskUsd: string): void {
    const account = this.requireAccount(accountId);
    if (account.archivedAt !== null)
      throw new AppError({
        code: 'validation-invalid',
        issues: [{ code: 'archived-account', path: 'riskUsd' }],
        message: 'Archived accounts cannot store new risk defaults.',
      });
    const normalized = new Decimal(riskUsd);
    if (!normalized.isFinite() || !normalized.isPositive())
      throw new AppError({
        code: 'validation-invalid',
        issues: [{ code: 'must-be-positive', path: 'riskUsd' }],
        message: 'The initial risk must be positive.',
      });
    this.vaultDatabase
      .require()
      .prepare('UPDATE accounts SET default_risk_usd = ?, updated_at = ? WHERE id = ?')
      .run(normalized.toFixed(), new Date().toISOString(), accountId);
  }

  public deleteCashMovement(id: string): CashMovement {
    const movement = this.getCashMovement(id);
    if (movement === null)
      throw new AppError({ code: 'vault-invalid', message: 'Cash movement does not exist.' });
    this.vaultDatabase.require().prepare('DELETE FROM cash_movements WHERE id = ?').run(id);
    return movement;
  }

  public getCashMovement(id: string): CashMovement | null {
    const row = this.vaultDatabase
      .require()
      .prepare(
        'SELECT id, account_id, account_name_snapshot, occurred_at, kind, amount_usd FROM cash_movements WHERE id = ?',
      )
      .get(id) as CashMovementRow | undefined;
    return row === undefined ? null : this.toCashMovement(row);
  }

  public listCashMovements(): readonly CashMovement[] {
    const rows = this.vaultDatabase
      .require()
      .prepare(
        'SELECT id, account_id, account_name_snapshot, occurred_at, kind, amount_usd FROM cash_movements ORDER BY occurred_at DESC, id DESC',
      )
      .all() as unknown as readonly CashMovementRow[];
    return rows.map((row) => this.toCashMovement(row));
  }

  public listAccountDefaults(accountId: string): readonly AccountInstrumentDefaults[] {
    const rows = this.vaultDatabase
      .require()
      .prepare(
        'SELECT account_id, instrument_id, commission_usd, spread_ticks, tick_size, tick_value_usd_per_lot, updated_at FROM account_instrument_defaults WHERE account_id = ? ORDER BY instrument_id',
      )
      .all(accountId) as unknown as readonly DefaultsRow[];
    return rows.map(toAccountDefault);
  }

  /**
   * Calculation ticks for one account+instrument pair. Returns `null` when the
   * pair has no complete tick profile, so the caller falls back to the legacy
   * instrument profile.
   */
  public getInstrumentCalculationProfile(
    accountId: string,
    instrumentId: string,
  ): { readonly tickSize: string; readonly tickValueUsdPerLot: string } | null {
    const row = this.vaultDatabase
      .require()
      .prepare(
        'SELECT account_id, instrument_id, commission_usd, spread_ticks, tick_size, tick_value_usd_per_lot, updated_at FROM account_instrument_defaults WHERE account_id = ? AND instrument_id = ?',
      )
      .get(accountId, instrumentId) as DefaultsRow | undefined;
    if (
      row === undefined ||
      row.tick_size === null ||
      row.tick_value_usd_per_lot === null ||
      row.tick_size === '' ||
      row.tick_value_usd_per_lot === ''
    ) {
      return null;
    }
    return { tickSize: row.tick_size, tickValueUsdPerLot: row.tick_value_usd_per_lot };
  }

  public listDefaultsForInstrument(instrumentId: string): readonly AccountInstrumentDefaults[] {
    const rows = this.vaultDatabase
      .require()
      .prepare(
        'SELECT account_id, instrument_id, commission_usd, spread_ticks, tick_size, tick_value_usd_per_lot, updated_at FROM account_instrument_defaults WHERE instrument_id = ? ORDER BY account_id',
      )
      .all(instrumentId) as unknown as readonly DefaultsRow[];
    return rows.map(toAccountDefault);
  }

  public listAccounts(): readonly (TradingAccount &
    AccountBalance & { readonly configuredAssetsCount: number })[] {
    const database = this.vaultDatabase.require();
    const rows = database
      .prepare(
        'SELECT id, name, opening_balance_usd, created_at, updated_at, archived_at, default_risk_usd FROM accounts ORDER BY archived_at IS NOT NULL, name',
      )
      .all() as unknown as readonly AccountRow[];

    // Grouped read models: one query per fact table keeps the projection
    // independent of the account count.
    const impactsByAccount = new Map<string, Decimal>();
    const impactRows = database
      .prepare(
        'SELECT account_id, account_balance_impact_usd FROM trades WHERE account_id IS NOT NULL AND account_balance_impact_usd IS NOT NULL',
      )
      .iterate() as unknown as IterableIterator<{
      readonly account_balance_impact_usd: string;
      readonly account_id: string;
    }>;
    for (const row of impactRows) {
      const current = impactsByAccount.get(row.account_id);
      impactsByAccount.set(
        row.account_id,
        current === undefined
          ? new Decimal(row.account_balance_impact_usd)
          : current.plus(row.account_balance_impact_usd),
      );
    }

    const movementsByAccount = new Map<string, Decimal>();
    const movementRows = database
      .prepare('SELECT account_id, kind, amount_usd FROM cash_movements')
      .iterate() as unknown as IterableIterator<{
      readonly account_id: string;
      readonly amount_usd: string;
      readonly kind: CashMovementKind;
    }>;
    for (const row of movementRows) {
      const current = movementsByAccount.get(row.account_id) ?? new Decimal(0);
      movementsByAccount.set(
        row.account_id,
        row.kind === CASH_MOVEMENT_KINDS.deposit
          ? current.plus(row.amount_usd)
          : current.minus(row.amount_usd),
      );
    }

    const uncoveredByAccount = new Map<string, number>();
    const uncoveredRows = database
      .prepare(
        'SELECT account_id, COUNT(*) AS count FROM trades WHERE account_id IS NOT NULL AND account_balance_impact_usd IS NULL GROUP BY account_id',
      )
      .all() as unknown as readonly { readonly account_id: string; readonly count: number }[];
    for (const row of uncoveredRows) {
      uncoveredByAccount.set(row.account_id, Number(row.count));
    }

    const defaultsByAccount = new Map<string, number>();
    const defaultRows = database
      .prepare(
        'SELECT account_id, COUNT(*) AS count FROM account_instrument_defaults GROUP BY account_id',
      )
      .all() as unknown as readonly { readonly account_id: string; readonly count: number }[];
    for (const row of defaultRows) {
      defaultsByAccount.set(row.account_id, Number(row.count));
    }

    return rows.map((row) => ({
      ...toAccount(row),
      accountId: row.id,
      configuredAssetsCount: defaultsByAccount.get(row.id) ?? 0,
      currentKnownBalanceUsd: new Decimal(row.opening_balance_usd)
        .plus(impactsByAccount.get(row.id) ?? 0)
        .plus(movementsByAccount.get(row.id) ?? 0)
        .toFixed(),
      openingBalanceUsd: row.opening_balance_usd,
      uncoveredTradeCount: uncoveredByAccount.get(row.id) ?? 0,
    }));
  }

  public restoreAccount(
    account: TradingAccount,
    defaults: readonly AccountInstrumentDefaults[],
  ): void {
    this.vaultDatabase.transaction(() => {
      this.vaultDatabase
        .require()
        .prepare(
          'INSERT OR REPLACE INTO accounts (id, name, opening_balance_usd, created_at, updated_at, archived_at, default_risk_usd) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          account.id,
          account.name,
          account.openingBalanceUsd,
          account.createdAt,
          account.updatedAt,
          account.archivedAt,
          account.defaultRiskUsd,
        );
      this.saveDefaults(account.id, defaults);
    });
  }

  public updateAccount(input: UpdateTradingAccountInput): TradingAccount {
    const now = new Date().toISOString();
    const existing = this.requireAccount(input.id);
    this.vaultDatabase.transaction(() => {
      this.vaultDatabase
        .require()
        .prepare(
          'UPDATE accounts SET name = ?, opening_balance_usd = ?, default_risk_usd = ?, updated_at = ? WHERE id = ?',
        )
        .run(
          input.name,
          new Decimal(input.openingBalanceUsd).toFixed(),
          input.defaultRiskUsd === undefined ? existing.defaultRiskUsd : input.defaultRiskUsd,
          now,
          input.id,
        );
      this.saveDefaults(
        input.id,
        input.defaults.map((item) => ({ ...item, accountId: input.id, updatedAt: now })),
      );
    });
    return this.requireAccount(input.id);
  }

  public restoreArchivedAccount(id: string): TradingAccount {
    return this.setArchived(id, null);
  }

  public saveDefaults(accountId: string, defaults: readonly AccountInstrumentDefaultWrite[]): void {
    const database = this.vaultDatabase.require();
    const now = new Date().toISOString();
    const existingArchived = new Set(
      (
        database
          .prepare(
            `SELECT d.instrument_id FROM account_instrument_defaults d
         JOIN instruments i ON i.id = d.instrument_id
         WHERE d.account_id = ? AND i.archived_at IS NOT NULL`,
          )
          .all(accountId) as unknown as readonly { instrument_id: string }[]
      ).map((row) => row.instrument_id),
    );
    defaults.forEach((item) => {
      const instrument = database
        .prepare('SELECT archived_at FROM instruments WHERE id = ?')
        .get(item.instrumentId) as { archived_at: string | null } | undefined;
      if (instrument === undefined)
        throw new AppError({ code: 'validation-invalid', message: 'Instrument does not exist.' });
      if (instrument.archived_at !== null && !existingArchived.has(item.instrumentId)) {
        throw new AppError({
          code: 'validation-invalid',
          message: 'Archived instruments cannot be newly configured.',
        });
      }
    });
    database.prepare('DELETE FROM account_instrument_defaults WHERE account_id = ?').run(accountId);
    const insert = database.prepare(
      'INSERT INTO account_instrument_defaults (account_id, instrument_id, commission_usd, spread_ticks, tick_size, tick_value_usd_per_lot, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    for (const item of defaults) {
      const tickSize = item.tickSize ?? null;
      const tickValueUsdPerLot = item.tickValueUsdPerLot ?? null;
      insert.run(
        accountId,
        item.instrumentId,
        new Decimal(item.commissionUsd).toFixed(),
        new Decimal(item.spreadTicks).toFixed(),
        tickSize === null ? null : new Decimal(tickSize).toFixed(),
        tickValueUsdPerLot === null ? null : new Decimal(tickValueUsdPerLot).toFixed(),
        item.updatedAt ?? now,
      );
    }
  }

  public updateCashMovement(input: UpdateCashMovementInput): CashMovement {
    const previous = this.getCashMovement(input.id);
    if (previous === null)
      throw new AppError({ code: 'vault-invalid', message: 'Cash movement does not exist.' });
    const account = this.requireAccount(input.accountId);
    if (account.archivedAt !== null) {
      throw new AppError({
        code: 'validation-invalid',
        issues: [{ code: 'archived-account', path: 'accountId' }],
        message: 'Archived accounts cannot receive cash movements.',
      });
    }
    this.validateMovement(input.kind, input.amountUsd, input.accountId, input.id);
    this.vaultDatabase.transaction(() => {
      this.validateMovement(input.kind, input.amountUsd, input.accountId, input.id);
      this.vaultDatabase
        .require()
        .prepare(
          'UPDATE cash_movements SET account_id = ?, account_name_snapshot = ?, occurred_at = ?, kind = ?, amount_usd = ? WHERE id = ?',
        )
        .run(
          account.id,
          account.name,
          input.occurredAt,
          input.kind,
          new Decimal(input.amountUsd).toFixed(),
          input.id,
        );
    });
    const movement = this.getCashMovement(input.id);
    if (movement === null) throw new Error('Cash movement was not updated.');
    return movement;
  }

  public getAccountById(id: string): TradingAccount | null {
    const row = this.vaultDatabase
      .require()
      .prepare(
        'SELECT id, name, opening_balance_usd, created_at, updated_at, archived_at, default_risk_usd FROM accounts WHERE id = ?',
      )
      .get(id) as AccountRow | undefined;
    return row === undefined ? null : toAccount(row);
  }

  private requireAccount(id: string): TradingAccount {
    const account = this.getAccountById(id);
    if (account === null)
      throw new AppError({ code: 'vault-invalid', message: 'Account does not exist.' });
    return account;
  }

  private setArchived(id: string, archivedAt: string | null): TradingAccount {
    this.requireAccount(id);
    this.vaultDatabase
      .require()
      .prepare('UPDATE accounts SET archived_at = ?, updated_at = ? WHERE id = ?')
      .run(archivedAt, new Date().toISOString(), id);
    return this.requireAccount(id);
  }

  private toCashMovement(row: CashMovementRow): CashMovement {
    return {
      accountId: row.account_id,
      accountName: row.account_name_snapshot,
      amountUsd: row.amount_usd,
      id: row.id,
      occurredAt: row.occurred_at,
      kind: row.kind,
    };
  }

  private validateMovement(
    kind: CashMovementKind,
    amountUsd: string,
    accountId: string,
    excludedMovementId?: string,
  ): void {
    if (kind !== CASH_MOVEMENT_KINDS.withdrawal) return;
    const balance = this.getAccountBalance(accountId, undefined, excludedMovementId);
    const previous =
      excludedMovementId === undefined ? null : this.getCashMovement(excludedMovementId);
    const available =
      previous?.kind === CASH_MOVEMENT_KINDS.withdrawal && previous.accountId === accountId
        ? new Decimal(balance.currentKnownBalanceUsd).plus(previous.amountUsd)
        : balance.currentKnownBalanceUsd;
    if (balance.uncoveredTradeCount > 0) {
      throw new AppError({
        code: 'validation-invalid',
        issues: [{ code: 'balance-incomplete', path: 'amountUsd' }],
        message: 'Cannot validate a withdrawal while the account balance is incomplete.',
      });
    }
    const unassignedLegacy = this.vaultDatabase
      .require()
      .prepare('SELECT COUNT(*) AS count FROM trades WHERE account_id IS NULL')
      .get() as { count: number };
    if (Number(unassignedLegacy.count ?? 0) > 0) {
      throw new AppError({
        code: 'validation-invalid',
        issues: [{ code: 'balance-incomplete', path: 'amountUsd' }],
        message: 'Assign legacy accountless trades before withdrawing funds.',
      });
    }
    if (new Decimal(amountUsd).greaterThan(available)) {
      throw new AppError({
        code: 'validation-invalid',
        issues: [{ code: 'insufficient-balance', path: 'amountUsd' }],
        message: 'Withdrawal exceeds the available account balance.',
      });
    }
  }
}
