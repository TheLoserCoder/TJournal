import type { TradeSummaryFact, TradeSummaryFactSource } from '@tjournal/analytics';

import { SqliteVaultDatabase } from './sqlite-vault-database';
import {
  toAccountAttribution,
  toInputResultKind,
  toNetResultUsd,
  toRiskBindingSnapshot,
  toTradeResultKind,
  type TradeAccountColumns,
  type TradeResultColumns,
  type TradeRiskBindingColumns,
} from './trade-row-mapping';

interface TradeSummaryFactRow
  extends TradeAccountColumns, TradeResultColumns, TradeRiskBindingColumns {
  readonly closed_at: string;
  readonly id: string;
  readonly instrument_id: string;
  readonly instrument_symbol: string;
}

const SUMMARY_FACT_SQL = `
  SELECT
    trades.id,
    trades.closed_at,
    trades.instrument AS instrument_symbol,
    trades.instrument_id,
    trades.result_kind,
    trades.result_value,
    trades.input_result_kind,
    trades.net_result_usd,
    trades.account_id,
    trades.account_name_snapshot,
    trades.account_balance_before_usd,
    trades.account_balance_impact_usd,
    trades.account_balance_conversion,
    trades.account_conversion_balance_usd,
    trades.account_initial_risk_usd,
    trades.risk_binding_kind,
    trades.risk_binding_value
  FROM trades
  JOIN instruments ON instruments.id = trades.instrument_id
  ORDER BY trades.closed_at DESC
`;

/**
 * Streams one lightweight fact at a time. The statement is iterated instead of
 * materialised, and exits/tags/notes are never read, so a summary does not grow
 * with the journal. The projection is ordered like the full trade read so exact
 * Decimal totals stay identical.
 */
export class SqliteTradeSummaryFactSource implements TradeSummaryFactSource {
  public constructor(private readonly vaultDatabase: SqliteVaultDatabase) {}

  public *scanSummaryFacts(): Iterable<TradeSummaryFact> {
    const rows = this.vaultDatabase
      .require()
      .prepare(SUMMARY_FACT_SQL)
      .iterate() as Iterable<unknown>;
    for (const value of rows) yield this.mapFact(value as TradeSummaryFactRow);
  }

  private mapFact(row: TradeSummaryFactRow): TradeSummaryFact {
    const resultKind = toTradeResultKind(row.result_kind);
    const netResultUsd = toNetResultUsd(row, resultKind);
    const inputResultKind = toInputResultKind(row.input_result_kind);
    return {
      account: toAccountAttribution(row),
      closedAt: row.closed_at,
      id: row.id,
      ...(inputResultKind === undefined ? {} : { inputResultKind }),
      instrumentId: row.instrument_id,
      instrumentSymbol: row.instrument_symbol,
      ...(netResultUsd === undefined ? {} : { netResultUsd }),
      resultKind,
      resultValue: row.result_value,
      riskBindingSnapshot: toRiskBindingSnapshot(row),
    };
  }
}
