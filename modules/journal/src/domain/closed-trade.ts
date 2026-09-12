export type TradeResultKind = 'cash' | 'percent';

export interface ClosedTrade {
  readonly closedAt: string;
  readonly id: string;
  readonly instrumentId: string;
  readonly instrumentSymbol: string;
  readonly resultKind: TradeResultKind;
  readonly resultValue: string;
}

export interface CreateClosedTradeInput {
  readonly closedAt: string;
  readonly instrumentId: string;
  readonly resultKind: TradeResultKind;
  readonly resultValue: string;
}
