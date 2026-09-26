import {
  RISK_BINDING_KINDS,
  TRADE_RESULT_KINDS,
  type AccountAttributionSnapshot,
  type RiskBindingSnapshot,
  type TradeResultKind,
} from '@tjournal/trade';

const ACCOUNT_BALANCE_CONVERSIONS = [
  'cash',
  'percent-of-balance',
  'r-cash-risk',
  'r-percent-risk',
] as const;

export interface TradeResultColumns {
  readonly account_balance_impact_usd: string | null;
  readonly input_result_kind: string | null;
  readonly net_result_usd: string | null;
  readonly result_kind: string;
  readonly result_value: string;
}

export const toTradeResultKind = (value: string): TradeResultKind =>
  value === TRADE_RESULT_KINDS.r
    ? TRADE_RESULT_KINDS.r
    : value === TRADE_RESULT_KINDS.percent
      ? TRADE_RESULT_KINDS.percent
      : TRADE_RESULT_KINDS.cash;

export const toInputResultKind = (value: string | null): TradeResultKind | undefined =>
  value === null ? undefined : toTradeResultKind(value);

/** Authoritative USD result in the same precedence as a full trade read. */
export const toNetResultUsd = (
  row: TradeResultColumns,
  resultKind: TradeResultKind,
): string | undefined =>
  row.net_result_usd ??
  row.account_balance_impact_usd ??
  (resultKind === TRADE_RESULT_KINDS.cash ? row.result_value : undefined);

export interface TradeAccountColumns {
  readonly account_balance_before_usd: string | null;
  readonly account_balance_conversion: string | null;
  readonly account_balance_impact_usd: string | null;
  readonly account_conversion_balance_usd: string | null;
  readonly account_id: string | null;
  readonly account_initial_risk_usd: string | null;
  readonly account_name_snapshot: string | null;
}

export const toAccountAttribution = (
  row: TradeAccountColumns,
): AccountAttributionSnapshot | null =>
  row.account_id === null ||
  row.account_name_snapshot === null ||
  row.account_balance_before_usd === null
    ? null
    : {
        accountId: row.account_id,
        accountName: row.account_name_snapshot,
        balanceBeforeUsd: row.account_balance_before_usd,
        balanceImpactUsd: row.account_balance_impact_usd,
        conversionBalanceUsd: row.account_conversion_balance_usd,
        conversion: ACCOUNT_BALANCE_CONVERSIONS.includes(
          row.account_balance_conversion as (typeof ACCOUNT_BALANCE_CONVERSIONS)[number],
        )
          ? (row.account_balance_conversion as (typeof ACCOUNT_BALANCE_CONVERSIONS)[number])
          : null,
        initialRiskUsd: row.account_initial_risk_usd,
      };

export interface TradeRiskBindingColumns {
  readonly risk_binding_kind: string | null;
  readonly risk_binding_value: string | null;
}

export const toRiskBindingSnapshot = (row: TradeRiskBindingColumns): RiskBindingSnapshot | null =>
  row.risk_binding_kind === null || row.risk_binding_value === null
    ? null
    : {
        kind:
          row.risk_binding_kind === RISK_BINDING_KINDS.percent
            ? RISK_BINDING_KINDS.percent
            : RISK_BINDING_KINDS.cash,
        source: 'vault-default',
        value: row.risk_binding_value,
      };
