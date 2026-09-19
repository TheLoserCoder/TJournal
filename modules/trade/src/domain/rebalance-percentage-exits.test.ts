import { describe, expect, it } from 'vitest';
import { calculatePercentageRemainder } from './rebalance-percentage-exits';

describe('calculatePercentageRemainder', () => {
  it('creates the exact remainder for a 25 percent first exit', () => {
    expect(calculatePercentageRemainder(['25'])).toBe('75');
  });
});
