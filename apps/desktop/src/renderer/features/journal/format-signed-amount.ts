import Decimal from 'decimal.js';

/**
 * Marks a positive authoritative amount with an explicit plus so it reserves the
 * same leading width as a negative value in the Result column. Zero stays plain.
 */
export const formatSignedAmount = (amount: string): string =>
  new Decimal(amount).gt(0) ? `+${amount}` : amount;
