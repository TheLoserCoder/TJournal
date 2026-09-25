import type {
  AccountDto,
  AccountInstrumentDefaultsDto,
  UpdateAccountDto,
} from '../../../shared/desktop-api';

/**
 * Builds the account update that remembers the table-settings 1R on the
 * account, preserving its configured asset defaults. Returns null when the
 * value is empty or already saved, so no redundant write happens.
 */
export const resolveAccountRiskUpdate = (
  account: AccountDto,
  defaults: readonly AccountInstrumentDefaultsDto[],
  riskUsd: string,
): UpdateAccountDto | null => {
  const normalized = riskUsd.trim();
  if (normalized === '' || normalized === account.defaultRiskUsd) return null;
  return {
    defaultRiskUsd: normalized,
    defaults: defaults.map(({ commissionUsd, instrumentId, spreadTicks }) => ({
      commissionUsd,
      instrumentId,
      spreadTicks,
    })),
    id: account.id,
    name: account.name,
    openingBalanceUsd: account.openingBalanceUsd,
  };
};

export type AccountRiskPersistencePlan =
  | { readonly kind: 'save'; readonly update: UpdateAccountDto }
  | { readonly kind: 'skip' }
  | { readonly kind: 'unavailable' };

/**
 * Decides whether the table-settings 1R may be written to the account. A failed
 * profile read (`null`) must not write: `updateAccount` replaces the whole
 * profile list, so saving with an unloaded list would erase stored profiles.
 */
export const planAccountRiskPersistence = (
  account: AccountDto,
  defaults: readonly AccountInstrumentDefaultsDto[] | null,
  riskUsd: string,
): AccountRiskPersistencePlan => {
  if (defaults === null) return { kind: 'unavailable' };
  const update = resolveAccountRiskUpdate(account, defaults, riskUsd);
  return update === null ? { kind: 'skip' } : { kind: 'save', update };
};
