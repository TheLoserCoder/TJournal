import Decimal from 'decimal.js';

const PERCENT_TOTAL = new Decimal(100);

export const calculatePercentageRemainder = (allocationsBeforeLast: readonly string[]): string => {
  const allocated = allocationsBeforeLast.reduce((sum, value) => sum.plus(value), new Decimal(0));
  const remainder = PERCENT_TOTAL.minus(allocated);
  return remainder.isNegative() ? '0' : remainder.toString();
};
