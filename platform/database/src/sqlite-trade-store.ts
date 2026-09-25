import { AppError } from '@tjournal/platform-errors';
import {
  EXIT_ALLOCATION_KINDS,
  RISK_BINDING_KINDS,
  TRADE_DIRECTIONS,
  TRADE_REVIEW_STATUSES,
  TRADE_RESULT_KINDS,
  TRADE_RESULT_SOURCES,
  type ClosedTrade,
  type JournalTableTradeRow,
  type NeutralRange,
  type TradeExecution,
  type TradeExit,
  type TradePreferences,
  type TradeResultKind,
  type TradeStore,
} from '@tjournal/trade';

import { SqliteVaultDatabase } from './sqlite-vault-database';

const VAULT_PREFERENCES_ID = 'vault';
const EXIT_QUERY_CHUNK_SIZE = 500;

interface ExecutionTradeRow extends TradeRow {
  readonly commission_usd: string;
  readonly entry_price: string;
  readonly quantity_lots: string;
  readonly snapshot_tick_size: string;
  readonly snapshot_tick_value_usd_per_lot: string;
  readonly spread_ticks: string;
}

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
  readonly entry_note: string | null;
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
  readonly review_note: string | null;
  readonly review_status: string;
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
  readonly trade_id: string;
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
      this.replaceTags(input.id, input.tagIds);
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

  public getTradeById(id: string): ClosedTrade | null {
    const row = this.vaultDatabase
      .require()
      .prepare(`${this.selectTradeSql()} WHERE trades.id = ?`)
      .get(id) as TradeRow | undefined;
    return row === undefined ? null : this.mapTrade(row, this.listTagIds(id), this.listExits(id));
  }

  public listTrades(): readonly ClosedTrade[] {
    const rows = this.vaultDatabase
      .require()
      .prepare(`${this.selectTradeSql()} ORDER BY trades.closed_at DESC`)
      .all() as unknown as readonly TradeRow[];
    const exitsByTrade = this.loadExitMap(rows.filter(hasExecutionRow).map((row) => row.id));
    const tagsByTrade = this.loadTagMap();
    return rows.map((row) =>
      this.mapTrade(row, tagsByTrade.get(row.id) ?? [], exitsByTrade.get(row.id) ?? []),
    );
  }

  public getTradesByIds(ids: readonly string[]): readonly ClosedTrade[] {
    if (ids.length === 0) return [];
    const database = this.vaultDatabase.require();
    const rowsById = new Map<string, TradeRow>();
    for (let start = 0; start < ids.length; start += EXIT_QUERY_CHUNK_SIZE) {
      const chunk = ids.slice(start, start + EXIT_QUERY_CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(', ');
      const rows = database
        .prepare(`${this.selectTradeSql()} WHERE trades.id IN (${placeholders})`)
        .all(...chunk) as unknown as readonly TradeRow[];
      rows.forEach((row) => rowsById.set(row.id, row));
    }
    const executionIds = ids.filter((id) => {
      const row = rowsById.get(id);
      return row !== undefined && hasExecutionRow(row);
    });
    const exitsByTrade = this.loadExitMap(executionIds);
    const tagsByTrade = this.loadTagMapForIds(ids);
    return ids.flatMap((id) => {
      const row = rowsById.get(id);
      return row === undefined
        ? []
        : [this.mapTrade(row, tagsByTrade.get(id) ?? [], exitsByTrade.get(id) ?? [])];
    });
  }

  public getJournalTableTradesByIds(ids: readonly string[]): readonly JournalTableTradeRow[] {
    if (ids.length === 0) return [];
    const database = this.vaultDatabase.require();
    const rowsById = new Map<string, TradeRow>();
    for (let start = 0; start < ids.length; start += EXIT_QUERY_CHUNK_SIZE) {
      const chunk = ids.slice(start, start + EXIT_QUERY_CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(', ');
      const rows = database
        .prepare(`${this.selectTradeSql()} WHERE trades.id IN (${placeholders})`)
        .all(...chunk) as unknown as readonly TradeRow[];
      rows.forEach((row) => rowsById.set(row.id, row));
    }
    const tagsByTrade = this.loadTagMapForIds(ids);
    return ids.flatMap((id) => {
      const row = rowsById.get(id);
      if (row === undefined) return [];
      const { entryNote, execution, reviewNote, reviewStatus, ...tableTrade } = this.mapTrade(
        row,
        tagsByTrade.get(id) ?? [],
        [],
      );
      void entryNote;
      void execution;
      void reviewNote;
      void reviewStatus;
      return [tableTrade];
    });
  }

  public restoreTrades(trades: readonly ClosedTrade[]): void {
    this.vaultDatabase.transaction(() => {
      for (const trade of trades) {
        this.insertTrade(trade, this.requireInstrument(trade.instrumentId).symbol);
        this.replaceExits(trade.id, trade.execution);
        this.replaceTags(trade.id, trade.tagIds);
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
        `UPDATE trades SET instrument = ?, instrument_id = ?, closed_at = ?, direction = ?, result_kind = ?, result_value = ?, result_source = ?, input_result_kind = ?, input_result_value = ?, net_result_usd = ?, risk_binding_kind = ?, risk_binding_value = ?, entry_price = ?, stop_loss_price = ?, quantity_lots = ?, commission_usd = ?, spread_ticks = ?, snapshot_tick_size = ?, snapshot_tick_value_usd_per_lot = ?, account_id = ?, account_name_snapshot = ?, account_balance_before_usd = ?, account_balance_impact_usd = ?, account_balance_conversion = ?, account_conversion_balance_usd = ?, account_initial_risk_usd = ?, entry_note = ?, review_note = ?, review_status = ? WHERE id = ?`,
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
        trade.entryNote,
        trade.reviewNote,
        trade.reviewStatus,
        trade.id,
      );
    if (result.changes === 0)
      throw new AppError({ code: 'vault-invalid', message: 'Trade does not exist.' });
    this.replaceExits(trade.id, trade.execution);
    this.replaceTags(trade.id, trade.tagIds);
  }

  private findTrade(id: string): ClosedTrade {
    const trade = this.getTradeById(id);
    if (trade === null)
      throw new AppError({ code: 'vault-invalid', message: 'Trade does not exist.' });
    return trade;
  }

  private insertTrade(trade: Omit<ClosedTrade, 'instrumentSymbol'>, symbol: string): void {
    this.vaultDatabase
      .require()
      .prepare(
        `INSERT INTO trades (id, instrument, instrument_id, closed_at, direction, result_kind, result_value, result_source, input_result_kind, input_result_value, net_result_usd, risk_binding_kind, risk_binding_value, entry_price, stop_loss_price, quantity_lots, commission_usd, spread_ticks, snapshot_tick_size, snapshot_tick_value_usd_per_lot, account_id, account_name_snapshot, account_balance_before_usd, account_balance_impact_usd, account_balance_conversion, account_conversion_balance_usd, account_initial_risk_usd, entry_note, review_note, review_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        trade.entryNote,
        trade.reviewNote,
        trade.reviewStatus,
      );
  }

  private mapTrade(
    row: TradeRow,
    tagIds: readonly string[],
    exits: readonly TradeExit[],
  ): ClosedTrade {
    const execution = this.mapExecution(row, exits);
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
      entryNote: row.entry_note,
      ...(netResultUsd === undefined ? {} : { netResultUsd }),
      reviewNote: row.review_note,
      reviewStatus:
        row.review_status === TRADE_REVIEW_STATUSES.reviewed
          ? TRADE_REVIEW_STATUSES.reviewed
          : TRADE_REVIEW_STATUSES.unreviewed,
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
      tagIds,
    };
  }

  private mapExecution(row: TradeRow, exits: readonly TradeExit[]): TradeExecution | null {
    if (!hasExecutionRow(row)) return null;
    return {
      commissionUsd: row.commission_usd,
      entryPrice: row.entry_price,
      exits,
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

  private listExits(tradeId: string): readonly TradeExit[] {
    const rows = this.vaultDatabase
      .require()
      .prepare('SELECT * FROM trade_exits WHERE trade_id = ? ORDER BY exit_order')
      .all(tradeId) as unknown as readonly ExitRow[];
    return rows.map(mapExitRow);
  }

  /** Loads exits for every execution-backed trade with a bounded query count. */
  private loadExitMap(tradeIds: readonly string[]): ReadonlyMap<string, readonly TradeExit[]> {
    const byTrade = new Map<string, TradeExit[]>();
    if (tradeIds.length === 0) return byTrade;
    const database = this.vaultDatabase.require();
    for (let start = 0; start < tradeIds.length; start += EXIT_QUERY_CHUNK_SIZE) {
      const chunk = tradeIds.slice(start, start + EXIT_QUERY_CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(', ');
      const rows = database
        .prepare(
          `SELECT * FROM trade_exits WHERE trade_id IN (${placeholders}) ORDER BY trade_id, exit_order`,
        )
        .all(...chunk) as unknown as readonly ExitRow[];
      for (const row of rows) {
        const exits = byTrade.get(row.trade_id);
        if (exits === undefined) byTrade.set(row.trade_id, [mapExitRow(row)]);
        else exits.push(mapExitRow(row));
      }
    }
    return byTrade;
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
  private listTagIds(tradeId: string): readonly string[] {
    const rows = this.vaultDatabase
      .require()
      .prepare('SELECT tag_id FROM trade_tags WHERE trade_id = ? ORDER BY tag_id')
      .all(tradeId) as unknown as readonly { readonly tag_id: string }[];
    return rows.map((row) => row.tag_id);
  }

  private loadTagMap(): ReadonlyMap<string, readonly string[]> {
    const rows = this.vaultDatabase
      .require()
      .prepare('SELECT trade_id, tag_id FROM trade_tags ORDER BY trade_id, tag_id')
      .all() as unknown as readonly { readonly tag_id: string; readonly trade_id: string }[];
    return this.groupTagRows(rows);
  }

  /** Batch tag lookup for a bounded set of trade ids. */
  private loadTagMapForIds(ids: readonly string[]): ReadonlyMap<string, readonly string[]> {
    const rows: { readonly tag_id: string; readonly trade_id: string }[] = [];
    const database = this.vaultDatabase.require();
    for (let start = 0; start < ids.length; start += EXIT_QUERY_CHUNK_SIZE) {
      const chunk = ids.slice(start, start + EXIT_QUERY_CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(', ');
      const chunkRows = database
        .prepare(
          `SELECT trade_id, tag_id FROM trade_tags WHERE trade_id IN (${placeholders}) ORDER BY trade_id, tag_id`,
        )
        .all(...chunk) as unknown as readonly {
        readonly tag_id: string;
        readonly trade_id: string;
      }[];
      rows.push(...chunkRows);
    }
    return this.groupTagRows(rows);
  }

  private groupTagRows(
    rows: readonly { readonly tag_id: string; readonly trade_id: string }[],
  ): ReadonlyMap<string, readonly string[]> {
    const byTrade = new Map<string, string[]>();
    for (const row of rows) {
      const existing = byTrade.get(row.trade_id);
      if (existing === undefined) {
        byTrade.set(row.trade_id, [row.tag_id]);
      } else {
        existing.push(row.tag_id);
      }
    }
    return byTrade;
  }

  private replaceTags(tradeId: string, tagIds: readonly string[]): void {
    const database = this.vaultDatabase.require();
    database.prepare('DELETE FROM trade_tags WHERE trade_id = ?').run(tradeId);
    if (tagIds.length === 0) return;
    const insert = database.prepare(
      'INSERT OR IGNORE INTO trade_tags (trade_id, tag_id) VALUES (?, ?)',
    );
    for (const tagId of tagIds) insert.run(tradeId, tagId);
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

const hasExecutionRow = (row: TradeRow): row is ExecutionTradeRow =>
  row.entry_price !== null &&
  row.quantity_lots !== null &&
  row.commission_usd !== null &&
  row.spread_ticks !== null &&
  row.snapshot_tick_size !== null &&
  row.snapshot_tick_value_usd_per_lot !== null;

const mapExitRow = (exit: ExitRow): TradeExit => ({
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
});
