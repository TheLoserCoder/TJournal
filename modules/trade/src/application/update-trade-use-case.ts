import Decimal from 'decimal.js';

import type { AccountBalanceReader, TradeStore } from '../contracts/trade-store';
import type { TradeTagReferenceReader } from '../contracts/tag-reference-reader';
import type { TradeUnitOfWork } from '../contracts/trade-unit-of-work';
import { calculateExecutionResult } from '../domain/calculate-execution-result';
import {
  TRADE_RESULT_KINDS,
  TRADE_RESULT_SOURCES,
  normalizeTagIds,
  type ClosedTrade,
  type RiskBindingSnapshot,
  type TradeResultKind,
} from '../domain/trade';
import { convertTradeResult } from '../domain/convert-trade-result';
import {
  TRADE_VALIDATION_CODES,
  TradeValidationError,
  normalizeTradeNotes,
  validateTradeInput,
} from '../domain/trade-validation';

/** Rebinds only an explicitly changed financial input; metadata edits keep the saved USD result. */
export class UpdateTradeUseCase {
  public constructor(
    private readonly tradeStore: TradeStore,
    private readonly tradeUnitOfWork: TradeUnitOfWork,
    private readonly accountStore: AccountBalanceReader,
    private readonly tagStore?: TradeTagReferenceReader,
  ) {}

  public execute(trade: ClosedTrade): ClosedTrade {
    const notes = normalizeTradeNotes(trade);
    validateTradeInput({
      ...trade,
      ...notes,
      accountId: trade.account?.accountId,
      riskUsd: trade.account?.initialRiskUsd ?? null,
    });
    const tagIds = this.requireKnownTagIds(normalizeTagIds(trade.tagIds));
    const calculation =
      trade.execution === null || trade.direction === null
        ? null
        : calculateExecutionResult(trade.direction, trade.execution);
    const accountId = trade.account?.accountId;
    const persisted = this.tradeStore.getTradeById(trade.id);
    const accountChanged = persisted?.account?.accountId !== accountId;
    const { financialInputChanged, nextInputValue, nextKind } = resolveResultInput(
      trade,
      persisted,
      calculation !== null,
    );

    if (accountId === undefined && !financialInputChanged)
      return this.tradeStore.updateTrade({ ...trade, ...notes });
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
      return this.tradeStore.updateTrade({ ...trade, ...notes });

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
      ...notes,
      tagIds,
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
    return this.tradeUnitOfWork.execute(() => {
      const saved = this.tradeStore.updateTrade(updated);
      if (riskBindingSnapshot !== null) {
        this.accountStore.saveAccountRiskUsd(accountId, riskBindingSnapshot.value);
      }
      return saved;
    });
  }

  private requireKnownTagIds(tagIds: readonly string[]): readonly string[] {
    if (tagIds.length === 0) return tagIds;
    if (this.tagStore === undefined) {
      throw new TradeValidationError([{ code: TRADE_VALIDATION_CODES.unknownTag, path: 'tagIds' }]);
    }
    const existing = new Set(this.tagStore.filterExistingTagIds(tagIds));
    if (tagIds.some((tagId) => !existing.has(tagId))) {
      throw new TradeValidationError([{ code: TRADE_VALIDATION_CODES.unknownTag, path: 'tagIds' }]);
    }
    return tagIds;
  }
}

interface ResolvedResultInput {
  readonly financialInputChanged: boolean;
  readonly nextInputValue: string;
  readonly nextKind: TradeResultKind;
}

/**
 * Detects an explicit financial edit against the persisted trade. The details
 * dialog edits the canonical result while other flows send a changed
 * quick-entry input; a metadata edit leaves both pairs unchanged.
 */
const resolveResultInput = (
  trade: ClosedTrade,
  persisted: ClosedTrade | null | undefined,
  calculated: boolean,
): ResolvedResultInput => {
  if (calculated) {
    return {
      financialInputChanged: true,
      nextInputValue: trade.inputResultValue ?? trade.resultValue,
      nextKind: TRADE_RESULT_KINDS.cash,
    };
  }
  const inputKind = trade.inputResultKind ?? trade.resultKind;
  const inputValue = trade.inputResultValue ?? trade.resultValue;
  if (persisted === null || persisted === undefined) {
    return { financialInputChanged: false, nextInputValue: inputValue, nextKind: inputKind };
  }
  if (trade.resultKind !== persisted.resultKind || trade.resultValue !== persisted.resultValue) {
    return {
      financialInputChanged: true,
      nextInputValue: trade.resultValue,
      nextKind: trade.resultKind,
    };
  }
  return {
    financialInputChanged:
      inputKind !== (persisted.inputResultKind ?? persisted.resultKind) ||
      inputValue !== (persisted.inputResultValue ?? persisted.resultValue),
    nextInputValue: inputValue,
    nextKind: inputKind,
  };
};
