import Decimal from 'decimal.js';

import type { AccountBalanceReader, TradeStore } from '../contracts/trade-store';
import { calculateExecutionResult } from '../domain/calculate-execution-result';
import {
  TRADE_RESULT_KINDS,
  TRADE_RESULT_SOURCES,
  type ClosedTrade,
  type RiskBindingSnapshot,
} from '../domain/trade';
import { convertTradeResult } from '../domain/convert-trade-result';
import {
  TRADE_VALIDATION_CODES,
  TradeValidationError,
  validateTradeInput,
} from '../domain/trade-validation';

/** Rebinds only an explicitly changed financial input; metadata edits keep the saved USD result. */
export class UpdateTradeUseCase {
  public constructor(
    private readonly tradeStore: TradeStore,
    private readonly accountStore: AccountBalanceReader,
  ) {}

  public execute(trade: ClosedTrade): ClosedTrade {
    validateTradeInput({
      ...trade,
      accountId: trade.account?.accountId,
      riskUsd: trade.account?.initialRiskUsd ?? null,
    });
    const calculation =
      trade.execution === null || trade.direction === null
        ? null
        : calculateExecutionResult(trade.direction, trade.execution);
    const nextKind =
      calculation === null ? (trade.inputResultKind ?? trade.resultKind) : TRADE_RESULT_KINDS.cash;
    const nextInputValue = trade.inputResultValue ?? trade.resultValue;
    const financialInputChanged =
      calculation !== null ||
      (trade.inputResultKind === undefined && trade.inputResultValue === undefined
        ? nextKind !== trade.resultKind || nextInputValue !== trade.resultValue
        : nextKind !== trade.inputResultKind || nextInputValue !== trade.inputResultValue);
    const accountId = trade.account?.accountId;
    const persisted = this.tradeStore.listTrades().find((item) => item.id === trade.id);
    const accountChanged = persisted?.account?.accountId !== accountId;

    if (accountId === undefined && !financialInputChanged)
      return this.tradeStore.updateTrade(trade);
    if (accountId === undefined) {
      throw new TradeValidationError([
        { code: TRADE_VALIDATION_CODES.missingAccount, path: 'accountId' },
      ]);
    }

    const unresolvedLegacyResult =
      trade.netResultUsd === undefined &&
      trade.inputResultKind === undefined &&
      trade.inputResultValue === undefined &&
      trade.resultKind !== TRADE_RESULT_KINDS.cash;
    if (unresolvedLegacyResult && !financialInputChanged) {
      throw new TradeValidationError([
        { code: TRADE_VALIDATION_CODES.unresolvedLegacyResult, path: 'resultValue' },
      ]);
    }

    // Metadata edits must not rebase a saved percentage or R conversion.
    if (!financialInputChanged && trade.netResultUsd !== undefined && !accountChanged)
      return this.tradeStore.updateTrade(trade);

    const context = this.accountStore.getAccountBalanceContext(accountId, trade.id, true);
    const needsFinancialConversion = financialInputChanged || trade.netResultUsd === undefined;
    const riskUsd = trade.account?.initialRiskUsd ?? context.defaultRiskUsd;
    const riskBindingSnapshot: RiskBindingSnapshot | null =
      needsFinancialConversion &&
      nextKind === TRADE_RESULT_KINDS.r &&
      riskUsd !== null &&
      riskUsd !== undefined
        ? { kind: 'cash', value: riskUsd, source: 'vault-default' }
        : needsFinancialConversion
          ? null
          : trade.riskBindingSnapshot;
    if (
      needsFinancialConversion &&
      nextKind === TRADE_RESULT_KINDS.r &&
      riskBindingSnapshot === null
    ) {
      throw new TradeValidationError([
        { code: TRADE_VALIDATION_CODES.missingInitialRisk, path: 'account.initialRiskUsd' },
      ]);
    }
    if (
      needsFinancialConversion &&
      nextKind === TRADE_RESULT_KINDS.percent &&
      !new Decimal(context.balanceBeforeUsd).isPositive()
    ) {
      throw new TradeValidationError([
        { code: TRADE_VALIDATION_CODES.percentBalanceUnavailable, path: 'resultValue' },
      ]);
    }

    const conversion =
      !needsFinancialConversion && trade.netResultUsd !== undefined
        ? {
            conversion: trade.account?.conversion ?? ('cash' as const),
            netResultUsd: trade.netResultUsd,
            conversionBalanceUsd: trade.account?.conversionBalanceUsd ?? null,
            initialRiskUsd: trade.account?.initialRiskUsd ?? null,
          }
        : calculation === null
          ? convertTradeResult(
              nextKind,
              nextInputValue,
              context.balanceBeforeUsd,
              riskBindingSnapshot?.value ?? null,
            )
          : {
              conversion: 'cash' as const,
              netResultUsd: calculation.netUsd,
              conversionBalanceUsd: null,
              initialRiskUsd: null,
            };
    const updated: ClosedTrade = {
      ...trade,
      account: {
        accountId: context.accountId,
        accountName: context.accountName,
        balanceBeforeUsd: context.balanceBeforeUsd,
        balanceImpactUsd: conversion.netResultUsd,
        conversionBalanceUsd: conversion.conversionBalanceUsd,
        conversion: conversion.conversion,
        initialRiskUsd: conversion.initialRiskUsd,
      },
      inputResultKind: nextKind,
      inputResultValue: nextInputValue,
      netResultUsd: conversion.netResultUsd,
      resultKind: calculation === null ? nextKind : TRADE_RESULT_KINDS.cash,
      resultSource:
        calculation === null ? TRADE_RESULT_SOURCES.manual : TRADE_RESULT_SOURCES.calculated,
      resultValue: calculation?.netUsd ?? nextInputValue,
      riskBindingSnapshot,
    };
    const saved = this.tradeStore.updateTrade(updated);
    if (riskBindingSnapshot !== null) {
      this.accountStore.saveAccountRiskUsd(accountId, riskBindingSnapshot.value);
    }
    return saved;
  }
}
