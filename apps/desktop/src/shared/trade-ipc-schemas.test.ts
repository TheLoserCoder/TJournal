import { describe, expect, it } from 'vitest';

import {
  createAccountSchema,
  instrumentProfileSchema,
  updateAccountSchema,
} from './trade-ipc-schemas';

const baseAccount = {
  defaults: [],
  name: 'Primary',
  openingBalanceUsd: '1000',
};

describe('account default risk IPC schema', () => {
  it('accepts an optional default risk on create and update', () => {
    expect(
      createAccountSchema.parse({ ...baseAccount, defaultRiskUsd: '150' }).defaultRiskUsd,
    ).toBe('150');
    expect(
      updateAccountSchema.parse({ ...baseAccount, defaultRiskUsd: null, id: 'acc-1' })
        .defaultRiskUsd,
    ).toBeNull();
    expect(createAccountSchema.parse(baseAccount).defaultRiskUsd).toBeUndefined();
  });

  it('rejects an empty default risk', () => {
    expect(() => createAccountSchema.parse({ ...baseAccount, defaultRiskUsd: '  ' })).toThrow();
  });
});

describe('instrument calculation profile IPC schema', () => {
  it('accepts a positive decimal profile', () => {
    expect(
      instrumentProfileSchema.parse({
        instrumentId: 'instrument-1',
        tickSize: '0.25',
        tickValueUsdPerLot: '12.5',
        updatedAt: '2026-09-22T00:00:00.000Z',
      }).tickSize,
    ).toBe('0.25');
  });

  it.each(['0', '0.0', '00.000'])('rejects a numerically zero tick value %s', (tickSize) => {
    expect(() =>
      instrumentProfileSchema.parse({
        instrumentId: 'instrument-1',
        tickSize,
        tickValueUsdPerLot: '12.5',
        updatedAt: '2026-09-22T00:00:00.000Z',
      }),
    ).toThrow();
  });
});
