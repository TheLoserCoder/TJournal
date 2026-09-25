import type {
  AnalyticsBreakdownDimension,
  AnalyticsFactQuery,
  AnalyticsFactSource,
  AnalyticsTradeFact,
} from '@tjournal/analytics';
import { ANALYTICS_BREAKDOWN_DIMENSIONS } from '@tjournal/analytics';
import type { InstrumentCategory } from '@tjournal/instrument';
import { TRADE_DIRECTIONS, type TradeDirection } from '@tjournal/trade';

import { SqliteVaultDatabase } from './sqlite-vault-database';

interface AnalyticsFactRow {
  readonly account_id: string | null;
  readonly account_label: string | null;
  readonly closed_at: string;
  readonly direction: string | null;
  readonly id: string;
  readonly instrument_category: string;
  readonly instrument_id: string;
  readonly instrument_label: string;
  readonly net_result_usd: string | null;
}

const INSTRUMENT_CATEGORIES = new Set<InstrumentCategory>([
  'crypto',
  'energy',
  'equity',
  'etf',
  'forex',
  'index',
  'metal',
]);

export class SqliteAnalyticsFactSource implements AnalyticsFactSource {
  public constructor(private readonly vaultDatabase: SqliteVaultDatabase) {}

  public *scanByDimension(
    query: AnalyticsFactQuery,
    dimension: AnalyticsBreakdownDimension,
  ): Iterable<AnalyticsTradeFact> {
    yield* this.scan(query, this.dimensionOrder(dimension));
  }

  public *scanChronologically(query: AnalyticsFactQuery): Iterable<AnalyticsTradeFact> {
    yield* this.scan(query, 'trades.closed_at ASC, trades.id ASC');
  }

  private *scan(query: AnalyticsFactQuery, orderBy: string): Iterable<AnalyticsTradeFact> {
    const { clauses, parameters } = this.where(query);
    const sql = `
      SELECT
        trades.id,
        trades.closed_at,
        trades.direction,
        trades.instrument_id,
        trades.instrument AS instrument_label,
        instruments.category AS instrument_category,
        trades.account_id,
        trades.account_name_snapshot AS account_label,
        trades.net_result_usd
      FROM trades
      JOIN instruments ON instruments.id = trades.instrument_id
      ${clauses.length === 0 ? '' : `WHERE ${clauses.join(' AND ')}`}
      ORDER BY ${orderBy}
    `;
    const rows = this.vaultDatabase
      .require()
      .prepare(sql)
      .iterate(...parameters) as Iterable<unknown>;
    for (const value of rows) yield this.mapRow(value as AnalyticsFactRow);
  }

  private where(query: AnalyticsFactQuery): {
    readonly clauses: readonly string[];
    readonly parameters: readonly string[];
  } {
    const clauses: string[] = [];
    const parameters: string[] = [];
    const addList = (column: string, values: readonly string[]): void => {
      if (values.length === 0) return;
      clauses.push(`${column} IN (${values.map(() => '?').join(', ')})`);
      parameters.push(...values);
    };
    if (query.range.fromInclusive !== null) {
      clauses.push('trades.closed_at >= ?');
      parameters.push(query.range.fromInclusive);
    }
    if (query.range.toExclusive !== null) {
      clauses.push('trades.closed_at < ?');
      parameters.push(query.range.toExclusive);
    }
    addList('trades.instrument_id', query.filters.instrumentIds);
    addList('instruments.category', query.filters.categories);
    addList('trades.direction', query.filters.directions);
    if (query.filters.accountIds.length > 0 || query.filters.includeUnassigned) {
      const assigned = query.filters.accountIds;
      const accountClauses: string[] = [];
      if (assigned.length > 0) {
        accountClauses.push(`trades.account_id IN (${assigned.map(() => '?').join(', ')})`);
        parameters.push(...assigned);
      }
      if (query.filters.includeUnassigned) accountClauses.push('trades.account_id IS NULL');
      clauses.push(`(${accountClauses.join(' OR ')})`);
    }
    return { clauses, parameters };
  }

  private dimensionOrder(dimension: AnalyticsBreakdownDimension): string {
    if (dimension === ANALYTICS_BREAKDOWN_DIMENSIONS.account)
      return "COALESCE(trades.account_id, '') ASC, trades.closed_at ASC, trades.id ASC";
    if (dimension === ANALYTICS_BREAKDOWN_DIMENSIONS.category)
      return 'instruments.category ASC, trades.closed_at ASC, trades.id ASC';
    return 'trades.instrument_id ASC, trades.closed_at ASC, trades.id ASC';
  }

  private mapRow(row: AnalyticsFactRow): AnalyticsTradeFact {
    if (!INSTRUMENT_CATEGORIES.has(row.instrument_category as InstrumentCategory))
      throw new Error('Trade instrument has an unsupported category.');
    return {
      accountId: row.account_id,
      accountLabel: row.account_label,
      closedAt: row.closed_at,
      direction: this.direction(row.direction),
      id: row.id,
      instrumentCategory: row.instrument_category as InstrumentCategory,
      instrumentId: row.instrument_id,
      instrumentLabel: row.instrument_label,
      netResultUsd: row.net_result_usd,
    };
  }

  private direction(value: string | null): TradeDirection | null {
    if (value === null) return null;
    if (value === TRADE_DIRECTIONS.long || value === TRADE_DIRECTIONS.short) return value;
    throw new Error('Trade has an unsupported direction.');
  }
}
