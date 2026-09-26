export interface TradingAccount {
  readonly id: string;
  readonly name: string;
  readonly openingBalanceUsd: string;
  readonly defaultRiskUsd: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
}

export interface AccountInstrumentDefaults {
  readonly accountId: string;
  readonly instrumentId: string;
  readonly commissionUsd: string;
  readonly spreadTicks: string;
  /** Calculation ticks live with the account cost profile, nullable when unset. */
  readonly tickSize: string | null;
  readonly tickValueUsdPerLot: string | null;
  readonly updatedAt: string;
}

/**
 * Entry-time cost-profile input. Ticks are optional so an account that never
 * uses calculated executions can keep commission/spread only.
 */
export type AccountInstrumentDefaultInput = Omit<
  AccountInstrumentDefaults,
  'accountId' | 'tickSize' | 'tickValueUsdPerLot' | 'updatedAt'
> & {
  readonly tickSize?: string | null;
  readonly tickValueUsdPerLot?: string | null;
};

/**
 * Write shape accepted by the store: the cost profile plus optional audit
 * fields, because create/restore already carry them while normal edits do not.
 */
export type AccountInstrumentDefaultWrite = AccountInstrumentDefaultInput & {
  readonly accountId?: string;
  readonly updatedAt?: string;
};

export interface AccountBalance {
  readonly accountId: string;
  readonly openingBalanceUsd: string;
  readonly currentKnownBalanceUsd: string;
  readonly uncoveredTradeCount: number;
}

export const CASH_MOVEMENT_KINDS = { deposit: 'deposit', withdrawal: 'withdrawal' } as const;
export type CashMovementKind = (typeof CASH_MOVEMENT_KINDS)[keyof typeof CASH_MOVEMENT_KINDS];

export interface CashMovement {
  readonly accountId: string;
  readonly accountName: string;
  readonly amountUsd: string;
  readonly id: string;
  readonly occurredAt: string;
  readonly kind: CashMovementKind;
}

export interface CreateCashMovementInput {
  readonly accountId: string;
  readonly amountUsd: string;
  readonly occurredAt: string;
  readonly kind: CashMovementKind;
}

export interface UpdateCashMovementInput extends CreateCashMovementInput {
  readonly id: string;
}

export interface CreateTradingAccountInput {
  readonly name: string;
  readonly openingBalanceUsd: string;
  readonly defaultRiskUsd?: string | null;
  readonly defaults?: readonly AccountInstrumentDefaultInput[];
}

export interface UpdateTradingAccountInput {
  readonly id: string;
  readonly name: string;
  readonly openingBalanceUsd: string;
  readonly defaultRiskUsd?: string | null;
  readonly defaults: readonly AccountInstrumentDefaultInput[];
}

export const normalizeAccountName = (name: string): string => {
  const normalized = name.trim();
  if (normalized.length === 0) throw new Error('Account name is required.');
  return normalized;
};

export const normalizeNonNegativeUsd = (value: string): string =>
  normalizeUnsignedDecimal(value, 'Opening balance');

export const normalizePositiveUsd = (value: string): string => {
  const normalized = normalizeUnsignedDecimal(value, 'USD amount');
  if (normalized === '0') throw new Error('USD amount must be positive.');
  return normalized;
};

const normalizeUnsignedDecimal = (value: string, label: string): string => {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (match === null) throw new Error(`${label} must be a finite decimal.`);
  const integer = (match[1] ?? '').replace(/^0+(?=\d)/, '');
  const fraction = (match[2] ?? '').replace(/0+$/, '');
  return fraction.length === 0 ? integer : `${integer}.${fraction}`;
};

export const normalizeAccountDefaults = (
  defaults: readonly AccountInstrumentDefaultInput[],
): readonly Omit<AccountInstrumentDefaults, 'accountId' | 'updatedAt'>[] => {
  const ids = new Set<string>();
  return defaults.map((item) => {
    if (ids.has(item.instrumentId)) throw new Error('Duplicate account instrument default.');
    ids.add(item.instrumentId);
    const tickSize = normalizeOptionalPositiveDecimal(item.tickSize, 'Tick size');
    const tickValueUsdPerLot = normalizeOptionalPositiveDecimal(
      item.tickValueUsdPerLot,
      'Tick value',
    );
    if ((tickSize === null) !== (tickValueUsdPerLot === null)) {
      throw new Error('Tick size and tick value must be configured together.');
    }
    return {
      commissionUsd: normalizeNonNegativeUsd(item.commissionUsd),
      instrumentId: item.instrumentId,
      spreadTicks: normalizeNonNegativeUsd(item.spreadTicks),
      tickSize,
      tickValueUsdPerLot,
    };
  });
};

const normalizeOptionalPositiveDecimal = (
  value: string | null | undefined,
  label: string,
): string | null => {
  const normalized = (value ?? '').trim();
  if (normalized === '') return null;
  const result = normalizeUnsignedDecimal(normalized, label);
  if (result === '0') throw new Error(`${label} must be positive.`);
  return result;
};
