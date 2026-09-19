import type {
  AccountBalance,
  AccountInstrumentDefaults,
  CashMovement,
  CreateCashMovementInput,
  CreateTradingAccountInput,
  TradingAccount,
  UpdateCashMovementInput,
  UpdateTradingAccountInput,
} from '../domain/account';

export interface AccountStore {
  createCashMovement(input: CreateCashMovementInput & { readonly id: string }): CashMovement;
  createAccount(input: CreateTradingAccountInput & { readonly id: string }): TradingAccount;
  deleteCashMovement(id: string): CashMovement;
  deleteAccount(id: string): TradingAccount;
  getAccountBalance(
    accountId: string,
    excludedTradeId?: string,
    excludedCashMovementId?: string,
  ): AccountBalance;
  getCashMovement(id: string): CashMovement | null;
  listCashMovements(): readonly CashMovement[];
  listAccountDefaults(accountId: string): readonly AccountInstrumentDefaults[];
  listDefaultsForInstrument(instrumentId: string): readonly AccountInstrumentDefaults[];
  listAccounts(): readonly (TradingAccount &
    AccountBalance & { readonly configuredAssetsCount: number })[];
  restoreAccount(account: TradingAccount, defaults: readonly AccountInstrumentDefaults[]): void;
  updateAccount(input: UpdateTradingAccountInput): TradingAccount;
  archiveAccount(id: string): TradingAccount;
  restoreArchivedAccount(id: string): TradingAccount;
  saveDefaults(accountId: string, defaults: readonly AccountInstrumentDefaults[]): void;
  updateCashMovement(input: UpdateCashMovementInput): CashMovement;
}
