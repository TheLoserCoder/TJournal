import { describe, expect, it } from 'vitest';

import type { AccountDto, AccountInstrumentDefaultsDto } from '../../../shared/desktop-api';
import { planAccountRiskPersistence, resolveAccountRiskUpdate } from './account-risk-update';

const account: AccountDto = {
  archivedAt: null,
  configuredAssetsCount: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  currentKnownBalanceUsd: '1000',
  defaultRiskUsd: null,
  id: 'acc-1',
  name: 'Primary',
  openingBalanceUsd: '1000',
  uncoveredTradeCount: 0,
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const defaults: readonly AccountInstrumentDefaultsDto[] = [
  {
    accountId: 'acc-1',
    commissionUsd: '1',
    instrumentId: 'eurusd',
    spreadTicks: '2',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

describe('resolveAccountRiskUpdate', () => {
  it('builds an account update that preserves the asset defaults', () => {
    expect(resolveAccountRiskUpdate(account, defaults, ' 150 ')).toEqual({
      defaultRiskUsd: '150',
      defaults: [{ commissionUsd: '1', instrumentId: 'eurusd', spreadTicks: '2' }],
      id: 'acc-1',
      name: 'Primary',
      openingBalanceUsd: '1000',
    });
  });

  it('returns null for an empty value or an unchanged default', () => {
    expect(resolveAccountRiskUpdate(account, defaults, '   ')).toBeNull();
    expect(
      resolveAccountRiskUpdate({ ...account, defaultRiskUsd: '150' }, defaults, '150'),
    ).toBeNull();
  });
});

describe('planAccountRiskPersistence', () => {
  it('refuses to write when the stored profiles could not be read', () => {
    expect(planAccountRiskPersistence(account, null, '150')).toEqual({ kind: 'unavailable' });
  });

  it('skips an empty or unchanged value', () => {
    expect(planAccountRiskPersistence(account, defaults, '   ')).toEqual({ kind: 'skip' });
    expect(
      planAccountRiskPersistence({ ...account, defaultRiskUsd: '150' }, defaults, '150'),
    ).toEqual({ kind: 'skip' });
  });

  it('plans a write that preserves every stored profile', () => {
    expect(planAccountRiskPersistence(account, defaults, ' 150 ')).toEqual({
      kind: 'save',
      update: {
        defaultRiskUsd: '150',
        defaults: [{ commissionUsd: '1', instrumentId: 'eurusd', spreadTicks: '2' }],
        id: 'acc-1',
        name: 'Primary',
        openingBalanceUsd: '1000',
      },
    });
  });
});
