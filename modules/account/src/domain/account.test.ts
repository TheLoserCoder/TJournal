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
});
