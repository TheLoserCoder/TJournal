import type {
  ClosedTrade,
  InstrumentCalculationSnapshot,
  SavedTradePreferences,
  TradePreferences,
  TradeRiskBindingSnapshot,
} from '../domain/trade';

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
  /**
   * Calculation ticks configured for the account+instrument pair. `null` means
   * the pair has no complete tick profile and the caller must fall back to the
   * legacy instrument profile.
   */
  getInstrumentCalculationProfile(
    accountId: string,
    instrumentId: string,
  ): InstrumentCalculationSnapshot | null;
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
  restoreTradePreferences(
    preferences: TradePreferences,
    reboundRiskBindings: readonly TradeRiskBindingSnapshot[],
  ): void;
  saveTradePreferences(
    preferences: TradePreferences,
    rebindHistorical?: boolean,
  ): SavedTradePreferences;
  updateTrade(trade: ClosedTrade): ClosedTrade;
}
