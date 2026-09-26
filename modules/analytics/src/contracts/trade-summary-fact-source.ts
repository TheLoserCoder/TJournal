import type { ClosedTrade } from '@tjournal/trade';

/**
 * The minimum projection a trade must expose to build a quick summary. Kept as
 * a `Pick` of the trade aggregate so the adapter maps values with exactly the
 * same rules as a full trade read, while exits, tag assignments and note
 * contents are never loaded for a summary.
 */
export type TradeSummaryFact = Pick<
  ClosedTrade,
  | 'account'
  | 'closedAt'
  | 'id'
  | 'inputResultKind'
  | 'instrumentId'
  | 'instrumentSymbol'
  | 'netResultUsd'
  | 'resultKind'
  | 'resultValue'
  | 'riskBindingSnapshot'
>;

/**
 * A bounded, streaming source of summary facts. The consumer iterates once and
 * keeps only running aggregates, so the journal size never determines the
 * memory held by a summary. Filtering stays in the application so the SQL
 * projection cannot drift from the table predicates.
 */
export interface TradeSummaryFactSource {
  scanSummaryFacts(): Iterable<TradeSummaryFact>;
}
