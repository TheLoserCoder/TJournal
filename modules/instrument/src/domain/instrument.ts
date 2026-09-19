export type InstrumentCategory =
  'crypto' | 'energy' | 'equity' | 'etf' | 'forex' | 'index' | 'metal';

export type InstrumentSource = 'custom' | 'seed';

export interface InstrumentCalculationProfile {
  readonly instrumentId: string;
  readonly tickSize: string;
  readonly tickValueUsdPerLot: string;
  readonly updatedAt: string;
}

export interface Instrument {
  readonly category: InstrumentCategory;
  readonly createdAt: string;
  readonly id: string;
  readonly source: InstrumentSource;
  readonly symbol: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
  readonly calculationProfile: InstrumentCalculationProfile | null;
}

export interface CreateInstrumentInput {
  readonly category: InstrumentCategory;
  readonly symbol: string;
  readonly calculationProfile?: Omit<
    InstrumentCalculationProfile,
    'instrumentId' | 'updatedAt'
  > | null;
}

export interface UpdateInstrumentInput extends CreateInstrumentInput {
  readonly id: string;
}

export const normalizeInstrumentSymbol = (symbol: string): string => {
  const normalized = symbol.trim().toUpperCase();
  if (normalized.length === 0) throw new Error('Instrument symbol is required.');
  return normalized;
};

export const normalizeCalculationProfile = (
  profile: CreateInstrumentInput['calculationProfile'],
): CreateInstrumentInput['calculationProfile'] => {
  if (profile === null || profile === undefined) return null;
  const tickSize = normalizePositiveDecimal(profile.tickSize, 'Tick size');
  const tickValueUsdPerLot = normalizePositiveDecimal(profile.tickValueUsdPerLot, 'Tick value');
  return { tickSize, tickValueUsdPerLot };
};

const normalizePositiveDecimal = (value: string, label: string): string => {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (match === null) throw new Error(`${label} must be a finite decimal.`);
  const integer = (match[1] ?? '').replace(/^0+(?=\d)/, '');
  const fraction = (match[2] ?? '').replace(/0+$/, '');
  if (integer === '0' && fraction.length === 0) throw new Error(`${label} must be positive.`);
  return fraction.length === 0 ? integer : `${integer}.${fraction}`;
};
