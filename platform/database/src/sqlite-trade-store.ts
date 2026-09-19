import { AppError } from '@tjournal/platform-errors';
import {
  EXIT_ALLOCATION_KINDS,
  RISK_BINDING_KINDS,
  TRADE_DIRECTIONS,
  TRADE_RESULT_KINDS,
  TRADE_RESULT_SOURCES,
  type ClosedTrade,
  type InstrumentCalculationProfile,
  type NeutralRange,
  type TradeExecution,
  type TradePreferences,
  type TradeResultKind,
  type TradeStore,
} from '@tjournal/trade';

import { SqliteVaultDatabase } from './sqlite-vault-database';

const VAULT_PREFERENCES_ID = 'vault';

interface TradeRow {
  readonly account_id: string | null;
  readonly account_name_snapshot: string | null;
  readonly account_balance_before_usd: string | null;
  readonly account_balance_impact_usd: string | null;
  readonly account_balance_conversion: string | null;
  readonly account_conversion_balance_usd: string | null;
  readonly account_initial_risk_usd: string | null;
  readonly closed_at: string;
  readonly commission_usd: string | null;
  readonly direction: string | null;
  readonly entry_price: string | null;
  readonly id: string;
  readonly instrument_id: string;
  readonly instrument_symbol: string;
  readonly input_result_kind: string | null;
  readonly input_result_value: string | null;
  readonly net_result_usd: string | null;
  readonly quantity_lots: string | null;
  readonly result_kind: string;
  readonly result_source: string;
  readonly result_value: string;
  readonly risk_binding_kind: string | null;
  readonly risk_binding_value: string | null;
  readonly snapshot_tick_size: string | null;
  readonly snapshot_tick_value_usd_per_lot: string | null;
  readonly spread_ticks: string | null;
  readonly stop_loss_price: string | null;
}
interface ExitRow {
  readonly allocation_kind: string;
  readonly allocation_value: string;
  readonly exit_order: number;
  readonly exit_price: string;
  readonly id: string;
  readonly reported_result_kind: string | null;
  readonly reported_result_value: string | null;
}
interface PreferencesRow {
  readonly neutral_include_commission: number;
  readonly neutral_include_spread: number;
  readonly neutral_cash_lower: string | null;
  readonly neutral_cash_upper: string | null;
  readonly neutral_percent_lower: string | null;
  readonly neutral_percent_upper: string | null;
  readonly neutral_r_lower: string | null;
  readonly neutral_r_upper: string | null;
  readonly risk_binding_kind: string | null;
  readonly risk_binding_value: string | null;
  readonly risk_prompt_dismissed: number;
}

export class SqliteTradeStore implements TradeStore {
  public constructor(private readonly vaultDatabase: SqliteVaultDatabase) {}

  public createTrade(input: Omit<ClosedTrade, 'instrumentSymbol'>): ClosedTrade {
    const instrument = this.requireInstrument(input.instrumentId);
    this.vaultDatabase.transaction(() => {
      this.insertTrade(input, instrument.symbol);
      this.replaceExits(input.id, input.execution);
    });
    return { ...input, instrumentSymbol: instrument.symbol };
  }

  public deleteTrade(id: string): ClosedTrade {
    const [trade] = this.deleteTrades([id]);
    if (trade === undefined)
      throw new AppError({ code: 'vault-invalid', message: 'Trade does not exist.' });
    return trade;
  }

  public deleteTrades(ids: readonly string[]): readonly ClosedTrade[] {
    return this.vaultDatabase.transaction(() => {
      const trades = ids.map((id) => this.findTrade(id));
      const statement = this.vaultDatabase.require().prepare('DELETE FROM trades WHERE id = ?');
      ids.forEach((id) => statement.run(id));
      return trades;
    });
  }

  public getInstrumentProfile(instrumentId: string): InstrumentCalculationProfile | null {
    const row = this.vaultDatabase
      .require()
      .prepare(
        'SELECT instrument_id, tick_size, tick_value_usd_per_lot, updated_at FROM instrument_calculation_profiles WHERE instrument_id = ?',
      )
      .get(instrumentId) as
      | {
          instrument_id: string;
          tick_size: string;
          tick_value_usd_per_lot: string;
          updated_at: string;
        }
      | undefined;
    return row === undefined
      ? null
      : {
          instrumentId: row.instrument_id,
          tickSize: row.tick_size,
          tickValueUsdPerLot: row.tick_value_usd_per_lot,
          updatedAt: row.updated_at,
        };
  }

  public getTradePreferences(): TradePreferences {
    const row = this.vaultDatabase
      .require()
      .prepare('SELECT * FROM trade_preferences WHERE id = ?')
      .get(VAULT_PREFERENCES_ID) as unknown as PreferencesRow;
    return {
      neutralCostSettings: {
        includeCommission: row.neutral_include_commission === 1,
        includeSpread: row.neutral_include_spread === 1,
      },
      neutralRanges: {
        cash: this.range(row.neutral_cash_lower, row.neutral_cash_upper),
        percent: this.range(row.neutral_percent_lower, row.neutral_percent_upper),
        r: this.range(row.neutral_r_lower, row.neutral_r_upper),
      },
      riskBinding:
        row.risk_binding_kind === null || row.risk_binding_value === null
          ? null
          : {
              kind:
                row.risk_binding_kind === RISK_BINDING_KINDS.percent
                  ? RISK_BINDING_KINDS.percent
                  : RISK_BINDING_KINDS.cash,
              value: row.risk_binding_value,
            },
      riskPromptDismissed: row.risk_prompt_dismissed === 1,
    };
  }

  public listTrades(): readonly ClosedTrade[] {
    const rows = this.vaultDatabase
      .require()
      .prepare(`${this.selectTradeSql()} ORDER BY trades.closed_at DESC`)
      .all() as unknown as readonly TradeRow[];
    return rows.map((row) => this.mapTrade(row));
  }

  public restoreTrades(trades: readonly ClosedTrade[]): void {
    this.vaultDatabase.transaction(() => {
      for (const trade of trades) {
        this.insertTrade(trade, this.requireInstrument(trade.instrumentId).symbol);
        this.replaceExits(trade.id, trade.execution);
      }
    });
  }

  public restoreTradePreferences(
    preferences: TradePreferences,
    trades: readonly ClosedTrade[],
  ): void {
    this.vaultDatabase.transaction(() => {
      this.writeTradePreferences(preferences);
      trades.forEach((trade) => this.updateTradeRow(trade));
    });
  }

  public saveInstrumentProfile(
    profile: InstrumentCalculationProfile,
  ): InstrumentCalculationProfile {
    this.requireInstrument(profile.instrumentId);
    this.vaultDatabase
      .require()
      .prepare(
        `INSERT INTO instrument_calculation_profiles (instrument_id, tick_size, tick_value_usd_per_lot, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(instrument_id) DO UPDATE SET tick_size = excluded.tick_size, tick_value_usd_per_lot = excluded.tick_value_usd_per_lot, updated_at = excluded.updated_at`,
      )
      .run(profile.instrumentId, profile.tickSize, profile.tickValueUsdPerLot, profile.updatedAt);
    return profile;
  }

  public saveTradePreferences(
    preferences: TradePreferences,
    rebindHistorical = false,
  ): TradePreferences {
    const previous = this.getTradePreferences();
    this.vaultDatabase.transaction(() => {
      this.writeTradePreferences(preferences);
      if (rebindHistorical && preferences.riskBinding !== null) {
        const database = this.vaultDatabase.require();
        if (previous.riskBinding === null) {
          database
            .prepare(
              `UPDATE trades SET risk_binding_kind = ?, risk_binding_value = ? WHERE result_kind = ? AND risk_binding_kind IS NULL`,
            )
            .run(preferences.riskBinding.kind, preferences.riskBinding.value, TRADE_RESULT_KINDS.r);
        } else {
          database
            .prepare(
              `UPDATE trades SET risk_binding_kind = ?, risk_binding_value = ? WHERE result_kind = ? AND (risk_binding_kind IS NULL OR (risk_binding_kind = ? AND risk_binding_value = ?))`,
            )
            .run(
              preferences.riskBinding.kind,
              preferences.riskBinding.value,
              TRADE_RESULT_KINDS.r,
              previous.riskBinding.kind,
              previous.riskBinding.value,
            );
        }
      }
    });
    return preferences;
  }

  private writeTradePreferences(preferences: TradePreferences): void {
    const range = (kind: TradeResultKind): NeutralRange | null => preferences.neutralRanges[kind];
    this.vaultDatabase
      .require()
      .prepare(
        `UPDATE trade_preferences SET
      risk_binding_kind = ?, risk_binding_value = ?, risk_prompt_dismissed = ?,
      neutral_include_commission = ?, neutral_include_spread = ?,
      neutral_cash_lower = ?, neutral_cash_upper = ?, neutral_percent_lower = ?, neutral_percent_upper = ?, neutral_r_lower = ?, neutral_r_upper = ? WHERE id = ?`,
      )
      .run(
        preferences.riskBinding?.kind ?? null,
        preferences.riskBinding?.value ?? null,
        preferences.riskPromptDismissed ? 1 : 0,
        preferences.neutralCostSettings.includeCommission ? 1 : 0,
        preferences.neutralCostSettings.includeSpread ? 1 : 0,
        range(TRADE_RESULT_KINDS.cash)?.lower ?? null,
        range(TRADE_RESULT_KINDS.cash)?.upper ?? null,
        range(TRADE_RESULT_KINDS.percent)?.lower ?? null,
        range(TRADE_RESULT_KINDS.percent)?.upper ?? null,
        range(TRADE_RESULT_KINDS.r)?.lower ?? null,
        range(TRADE_RESULT_KINDS.r)?.upper ?? null,
        VAULT_PREFERENCES_ID,
      );
  }

  public updateTrade(trade: ClosedTrade): ClosedTrade {
    const instrument = this.requireInstrument(trade.instrumentId);
    this.vaultDatabase.transaction(() => {
      this.updateTradeRow({ ...trade, instrumentSymbol: instrument.symbol });
    });
    return { ...trade, instrumentSymbol: instrument.symbol };
  }

  private updateTradeRow(trade: ClosedTrade): void {
    const instrument = this.requireInstrument(trade.instrumentId);
    const result = this.vaultDatabase
      .require()
      .prepare(
        `UPDATE trades SET instrument = ?, instrument_id = ?, closed_at = ?, direction = ?, result_kind = ?, result_value = ?, result_source = ?, input_result_kind = ?, input_result_value = ?, net_result_usd = ?, risk_binding_kind = ?, risk_binding_value = ?, entry_price = ?, stop_loss_price = ?, quantity_lots = ?, commission_usd = ?, spread_ticks = ?, snapshot_tick_size = ?, snapshot_tick_value_usd_per_lot = ?, account_id = ?, account_name_snapshot = ?, account_balance_before_usd = ?, account_balance_impact_usd = ?, account_balance_conversion = ?, account_conversion_balance_usd = ?, account_initial_risk_usd = ? WHERE id = ?`,
      )
      .run(
        instrument.symbol,
        trade.instrumentId,
        trade.closedAt,
        trade.direction,
        trade.resultKind,
        trade.resultValue,
        trade.resultSource,
        trade.inputResultKind ?? null,
        trade.inputResultValue ?? null,
        trade.netResultUsd ?? null,
        trade.riskBindingSnapshot?.kind ?? null,
        trade.riskBindingSnapshot?.value ?? null,
        trade.execution?.entryPrice ?? null,
        trade.execution?.stopLossPrice ?? null,
        trade.execution?.quantityLots ?? null,
        trade.execution?.commissionUsd ?? null,
        trade.execution?.spreadTicks ?? null,
        trade.execution?.instrumentSnapshot.tickSize ?? null,
        trade.execution?.instrumentSnapshot.tickValueUsdPerLot ?? null,
        trade.account?.accountId ?? null,
        trade.account?.accountName ?? null,
        trade.account?.balanceBeforeUsd ?? null,
        trade.account?.balanceImpactUsd ?? null,
        trade.account?.conversion ?? null,
        trade.account?.conversionBalanceUsd ?? null,
        trade.account?.initialRiskUsd ?? null,
        trade.id,
      );
    if (result.changes === 0)
      throw new AppError({ code: 'vault-invalid', message: 'Trade does not exist.' });
    this.replaceExits(trade.id, trade.execution);
  }

  private findTrade(id: string): ClosedTrade {
    const row = this.vaultDatabase
      .require()
      .prepare(`${this.selectTradeSql()} WHERE trades.id = ?`)
      .get(id) as TradeRow | undefined;
    if (row === undefined)
      throw new AppError({ code: 'vault-invalid', message: 'Trade does not exist.' });
    return this.mapTrade(row);
  }

  private insertTrade(trade: Omit<ClosedTrade, 'instrumentSymbol'>, symbol: string): void {
    this.vaultDatabase
      .require()
      .prepare(
        `INSERT INTO trades (id, instrument, instrument_id, closed_at, direction, result_kind, result_value, result_source, input_result_kind, input_result_value, net_result_usd, risk_binding_kind, risk_binding_value, entry_price, stop_loss_price, quantity_lots, commission_usd, spread_ticks, snapshot_tick_size, snapshot_tick_value_usd_per_lot, account_id, account_name_snapshot, account_balance_before_usd, account_balance_impact_usd, account_balance_conversion, account_conversion_balance_usd, account_initial_risk_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        trade.id,
        symbol,
        trade.instrumentId,
        trade.closedAt,
        trade.direction,
        trade.resultKind,
        trade.resultValue,
        trade.resultSource,
        trade.inputResultKind ?? null,
        trade.inputResultValue ?? null,
        trade.netResultUsd ?? null,
        trade.riskBindingSnapshot?.kind ?? null,
        trade.riskBindingSnapshot?.value ?? null,
        trade.execution?.entryPrice ?? null,
        trade.execution?.stopLossPrice ?? null,
        trade.execution?.quantityLots ?? null,
        trade.execution?.commissionUsd ?? null,
        trade.execution?.spreadTicks ?? null,
        trade.execution?.instrumentSnapshot.tickSize ?? null,
        trade.execution?.instrumentSnapshot.tickValueUsdPerLot ?? null,
        trade.account?.accountId ?? null,
        trade.account?.accountName ?? null,
        trade.account?.balanceBeforeUsd ?? null,
        trade.account?.balanceImpactUsd ?? null,
        trade.account?.conversion ?? null,
        trade.account?.conversionBalanceUsd ?? null,
        trade.account?.initialRiskUsd ?? null,
      );
  }

  private mapTrade(row: TradeRow): ClosedTrade {
    const execution = this.mapExecution(row);
    const resultKind =
      row.result_kind === TRADE_RESULT_KINDS.r
        ? TRADE_RESULT_KINDS.r
        : row.result_kind === TRADE_RESULT_KINDS.percent
          ? TRADE_RESULT_KINDS.percent
          : TRADE_RESULT_KINDS.cash;
    const netResultUsd =
      row.net_result_usd ??
      row.account_balance_impact_usd ??
      (resultKind === TRADE_RESULT_KINDS.cash ? row.result_value : undefined);
    const inputResultKind =
      row.input_result_kind === null
        ? undefined
        : row.input_result_kind === TRADE_RESULT_KINDS.r
          ? TRADE_RESULT_KINDS.r
          : row.input_result_kind === TRADE_RESULT_KINDS.percent
            ? TRADE_RESULT_KINDS.percent
            : TRADE_RESULT_KINDS.cash;
    const inputResultValue = row.input_result_value ?? undefined;
    return {
      account:
        row.account_id === null ||
        row.account_name_snapshot === null ||
        row.account_balance_before_usd === null
          ? null
          : {
              accountId: row.account_id,
              accountName: row.account_name_snapshot,
              balanceBeforeUsd: row.account_balance_before_usd,
              balanceImpactUsd: row.account_balance_impact_usd,
              conversionBalanceUsd: row.account_conversion_balance_usd,
              conversion:
                row.account_balance_conversion === 'cash' ||
                row.account_balance_conversion === 'percent-of-balance' ||
                row.account_balance_conversion === 'r-cash-risk' ||
                row.account_balance_conversion === 'r-percent-risk'
                  ? row.account_balance_conversion
                  : null,
              initialRiskUsd: row.account_initial_risk_usd,
            },
      closedAt: row.closed_at,
      direction:
        row.direction === null
          ? null
          : row.direction === TRADE_DIRECTIONS.short
            ? TRADE_DIRECTIONS.short
            : TRADE_DIRECTIONS.long,
      execution,
      id: row.id,
      ...(inputResultKind === undefined ? {} : { inputResultKind }),
      ...(inputResultValue === undefined ? {} : { inputResultValue }),
      instrumentId: row.instrument_id,
      instrumentSymbol: row.instrument_symbol,
      ...(netResultUsd === undefined ? {} : { netResultUsd }),
      resultKind,
      resultSource:
        row.result_source === TRADE_RESULT_SOURCES.calculated
          ? TRADE_RESULT_SOURCES.calculated
          : TRADE_RESULT_SOURCES.manual,
      resultValue: row.result_value,
      riskBindingSnapshot:
        row.risk_binding_kind === null || row.risk_binding_value === null
          ? null
          : {
              kind:
                row.risk_binding_kind === RISK_BINDING_KINDS.percent
                  ? RISK_BINDING_KINDS.percent
                  : RISK_BINDING_KINDS.cash,
              source: 'vault-default',
              value: row.risk_binding_value,
            },
    };
  }

  private mapExecution(row: TradeRow): TradeExecution | null {
    if (
      row.entry_price === null ||
      row.quantity_lots === null ||
      row.commission_usd === null ||
      row.spread_ticks === null ||
      row.snapshot_tick_size === null ||
      row.snapshot_tick_value_usd_per_lot === null
    )
      return null;
    const exits = this.vaultDatabase
      .require()
      .prepare('SELECT * FROM trade_exits WHERE trade_id = ? ORDER BY exit_order')
      .all(row.id) as unknown as readonly ExitRow[];
    return {
      commissionUsd: row.commission_usd,
      entryPrice: row.entry_price,
      exits: exits.map((exit) => ({
        allocationKind:
          exit.allocation_kind === EXIT_ALLOCATION_KINDS.lots
            ? EXIT_ALLOCATION_KINDS.lots
            : EXIT_ALLOCATION_KINDS.percent,
        allocationValue: exit.allocation_value,
        exitPrice: exit.exit_price,
        id: exit.id,
        order: exit.exit_order,
        reportedResultKind:
          exit.reported_result_kind === TRADE_RESULT_KINDS.cash
            ? TRADE_RESULT_KINDS.cash
            : exit.reported_result_kind === TRADE_RESULT_KINDS.percent
              ? TRADE_RESULT_KINDS.percent
              : null,
        reportedResultValue: exit.reported_result_value,
      })),
      instrumentSnapshot: {
        tickSize: row.snapshot_tick_size,
        tickValueUsdPerLot: row.snapshot_tick_value_usd_per_lot,
      },
      quantityLots: row.quantity_lots,
      spreadTicks: row.spread_ticks,
      stopLossPrice: row.stop_loss_price,
    };
  }

  private range(lower: string | null, upper: string | null): NeutralRange | null {
    return lower === null || upper === null ? null : { lower, upper };
  }
  private replaceExits(tradeId: string, execution: TradeExecution | null): void {
    const database = this.vaultDatabase.require();
    database.prepare('DELETE FROM trade_exits WHERE trade_id = ?').run(tradeId);
    if (execution === null) return;
    const insert = database.prepare(
      'INSERT INTO trade_exits (id, trade_id, exit_order, exit_price, allocation_kind, allocation_value, reported_result_kind, reported_result_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    execution.exits.forEach((exit) =>
      insert.run(
        exit.id,
        tradeId,
        exit.order,
        exit.exitPrice,
        exit.allocationKind,
        exit.allocationValue,
        exit.reportedResultKind,
        exit.reportedResultValue,
      ),
    );
  }
  private requireInstrument(id: string): { readonly symbol: string } {
    const row = this.vaultDatabase
      .require()
      .prepare('SELECT symbol FROM instruments WHERE id = ?')
      .get(id) as { symbol: string } | undefined;
    if (row === undefined)
      throw new AppError({ code: 'vault-invalid', message: 'Trade instrument does not exist.' });
    return row;
  }
  private selectTradeSql(): string {
    return `SELECT trades.*, trades.instrument AS instrument_symbol FROM trades JOIN instruments ON instruments.id = trades.instrument_id`;
  }
}
