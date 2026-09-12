export type InstrumentCategory =
  'crypto' | 'energy' | 'equity' | 'etf' | 'forex' | 'index' | 'metal';

export type InstrumentSource = 'custom' | 'seed';

export interface Instrument {
  readonly category: InstrumentCategory;
  readonly createdAt: string;
  readonly id: string;
  readonly source: InstrumentSource;
  readonly symbol: string;
}

export interface CreateInstrumentInput {
  readonly category: InstrumentCategory;
  readonly symbol: string;
}

export const normalizeInstrumentSymbol = (symbol: string): string => symbol.trim().toUpperCase();
