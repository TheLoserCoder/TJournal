import { describe, expect, it } from 'vitest';

import { formatDecimalString } from './format-decimal';

describe('formatDecimalString', () => {
  it('rounds to at most two digits and preserves the sign', () => {
    expect(formatDecimalString('12345.678', 'en')).toBe('12,345.68');
    expect(formatDecimalString('-12345.674', 'ru')).toBe('-12\u00a0345,67');
    expect(formatDecimalString('-0.004', 'en')).toBe('0');
  });

  it('does not convert large exact values through JavaScript number', () => {
    expect(formatDecimalString('12345678901234567890.5', 'en')).toBe(
      '12,345,678,901,234,567,890.5',
    );
  });
});
