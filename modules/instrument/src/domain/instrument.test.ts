import { describe, expect, it } from 'vitest';

import { normalizeCalculationProfile, normalizeInstrumentSymbol } from './instrument';

describe('instrument domain', () => {
  it('normalizes symbols and paired profiles', () => {
    expect(normalizeInstrumentSymbol(' eurusd ')).toBe('EURUSD');
    expect(normalizeCalculationProfile({ tickSize: '0.0100', tickValueUsdPerLot: '2.50' })).toEqual(
      { tickSize: '0.01', tickValueUsdPerLot: '2.5' },
    );
  });

  it('rejects zero and incomplete profile values', () => {
    expect(() => normalizeCalculationProfile({ tickSize: '0', tickValueUsdPerLot: '1' })).toThrow();
    expect(() => normalizeCalculationProfile({ tickSize: '', tickValueUsdPerLot: '1' })).toThrow();
  });
});
