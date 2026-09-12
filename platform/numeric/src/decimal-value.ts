import Decimal from 'decimal.js';

export type DecimalValue = string;

export const normalizeDecimal = (value: string): DecimalValue => {
  const decimal = new Decimal(value);

  if (!decimal.isFinite()) {
    throw new Error('Decimal value must be finite.');
  }

  return decimal.toFixed();
};
