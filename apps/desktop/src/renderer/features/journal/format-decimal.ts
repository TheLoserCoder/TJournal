import Decimal from 'decimal.js';

const MAX_FRACTION_DIGITS = 2;
const GROUP_SEPARATOR = '\u00a0';

export const formatDecimalString = (value: string, language: string): string => {
  const rounded = new Decimal(value).toDecimalPlaces(MAX_FRACTION_DIGITS, Decimal.ROUND_HALF_UP);
  const normalized = rounded.isZero() ? new Decimal(0) : rounded;
  const [integerPart = '0', fractionPart = ''] = normalized.toFixed(MAX_FRACTION_DIGITS).split('.');
  const negative = integerPart.startsWith('-');
  const digits = negative ? integerPart.slice(1) : integerPart;
  const grouped = digits.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    language === 'ru' ? GROUP_SEPARATOR : ',',
  );
  const fraction = fractionPart.replace(/0+$/, '');
  const decimalSeparator = language === 'ru' ? ',' : '.';
  return `${negative ? '-' : ''}${grouped}${fraction === '' ? '' : decimalSeparator + fraction}`;
};
