import { describe, expect, it } from 'vitest';

import { normalizeAccountDefaults, normalizeAccountName, normalizeNonNegativeUsd } from './account';

describe('account domain', () => {
  it('normalizes names and non-negative decimal values', () => {
    expect(normalizeAccountName('  Main  ')).toBe('Main');
    expect(normalizeNonNegativeUsd('00012.5000')).toBe('12.5');
  });

  it('rejects invalid balances and duplicate defaults', () => {
    expect(() => normalizeNonNegativeUsd('-1')).toThrow();
    expect(() =>
      normalizeAccountDefaults([
        { commissionUsd: '0', instrumentId: 'asset-1', spreadTicks: '0' },
        { commissionUsd: '0', instrumentId: 'asset-1', spreadTicks: '0' },
      ]),
    ).toThrow();
  });

  it('normalizes optional calculation ticks and requires them as a pair', () => {
    expect(
      normalizeAccountDefaults([
        {
          commissionUsd: '1',
          instrumentId: 'asset-1',
          spreadTicks: '2',
          tickSize: '000.2500',
          tickValueUsdPerLot: '12.500',
        },
      ]),
    ).toEqual([
      {
        commissionUsd: '1',
        instrumentId: 'asset-1',
        spreadTicks: '2',
        tickSize: '0.25',
        tickValueUsdPerLot: '12.5',
      },
    ]);

    expect(
      normalizeAccountDefaults([
        { commissionUsd: '0', instrumentId: 'asset-1', spreadTicks: '0' },
      ])[0],
    ).toMatchObject({ tickSize: null, tickValueUsdPerLot: null });

    // A half-configured tick pair and a zero tick are invalid.
    expect(() =>
      normalizeAccountDefaults([
        { commissionUsd: '0', instrumentId: 'asset-1', spreadTicks: '0', tickSize: '0.25' },
      ]),
    ).toThrow();
    expect(() =>
      normalizeAccountDefaults([
        {
          commissionUsd: '0',
          instrumentId: 'asset-1',
          spreadTicks: '0',
          tickSize: '0',
          tickValueUsdPerLot: '1',
        },
      ]),
    ).toThrow();
  });
});
