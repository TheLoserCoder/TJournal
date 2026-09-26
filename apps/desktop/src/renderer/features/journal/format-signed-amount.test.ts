import { describe, expect, it } from 'vitest';

import { formatSignedAmount } from './format-signed-amount';

describe('formatSignedAmount', () => {
  it('marks positive amounts explicitly so they align with negative ones', () => {
    expect(formatSignedAmount('25')).toBe('+25');
    expect(formatSignedAmount('100.5')).toBe('+100.5');
  });

  it('keeps negative and zero amounts unchanged', () => {
    expect(formatSignedAmount('-100')).toBe('-100');
    expect(formatSignedAmount('0')).toBe('0');
    expect(formatSignedAmount('0.00')).toBe('0.00');
  });
});
