import type { ClosedTrade, TradePreferences } from '../domain/trade';

export interface AccountBalanceContext {
  readonly accountId: string;
  readonly accountName: string;
  readonly balanceBeforeUsd: string;
  readonly defaultRiskUsd: string | null;
}

export interface AccountBalanceReader {
  getAccountBalanceContext(
    accountId: string,
    excludedTradeId?: string,
    allowArchived?: boolean,
  ): AccountBalanceContext;
  saveAccountRiskUsd(accountId: string, riskUsd: string): void;
}

export interface TradeStore {
  createTrade(input: Omit<ClosedTrade, 'instrumentSymbol'>): ClosedTrade;
  deleteTrade(id: string): ClosedTrade;
  deleteTrades(ids: readonly string[]): readonly ClosedTrade[];
  getTradeById(id: string): ClosedTrade | null;
  /** Batch point lookup preserving the requested order and skipping unknown ids. */
  getTradesByIds(ids: readonly string[]): readonly ClosedTrade[];
  getTradePreferences(): TradePreferences;
  listTrades(): readonly ClosedTrade[];
  restoreTrades(trades: readonly ClosedTrade[]): void;
  restoreTradePreferences(preferences: TradePreferences, trades: readonly ClosedTrade[]): void;
  saveTradePreferences(preferences: TradePreferences, rebindHistorical?: boolean): TradePreferences;
  updateTrade(trade: ClosedTrade): ClosedTrade;
}
