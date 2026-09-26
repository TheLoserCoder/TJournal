import { randomUUID } from 'node:crypto';

import type { InstrumentStore } from '@tjournal/instrument';

import type { TradeStore } from '../contracts/trade-store';
import type { AccountBalanceReader } from '../contracts/trade-store';
import type { TradeTagReferenceReader } from '../contracts/tag-reference-reader';
import type { TradeUnitOfWork } from '../contracts/trade-unit-of-work';
import Decimal from 'decimal.js';
import { calculateExecutionResult } from '../domain/calculate-execution-result';
import {
  TRADE_RESULT_KINDS,
  TRADE_RESULT_SOURCES,
  TRADE_REVIEW_STATUSES,
  normalizeTagIds,
  type ClosedTrade,
  type CreateClosedTradeInput,
  type RiskBindingSnapshot,
} from '../domain/trade';
import { convertTradeResult, TRADE_RESULT_CONVERSIONS } from '../domain/convert-trade-result';
import {
  TRADE_VALIDATION_CODES,
  TradeValidationError,
  normalizeTradeNotes,
  validateTradeInput,
} from '../domain/trade-validation';

export class CreateTradeUseCase {
  public constructor(
    private readonly tradeStore: TradeStore,
    private readonly tradeUnitOfWork: TradeUnitOfWork,
    private readonly accountStore?: AccountBalanceReader,
    private readonly tagStore?: TradeTagReferenceReader,
    private readonly instrumentStore?: Pick<InstrumentStore, 'getInstrumentProfile'>,
  ) {}

  public execute(input: CreateClosedTradeInput, id: string = randomUUID()): ClosedTrade {
    const { accountId, riskUsd: requestedRiskUsd, ...tradeInput } = input;
    const notes = normalizeTradeNotes(input);
    validateTradeInput({ ...input, ...notes });
    const tagIds = this.requireKnownTagIds(normalizeTagIds(input.tagIds));
    const accountStore = this.accountStore;
    if (accountStore === undefined || accountId === undefined || accountId === null) {
      throw new TradeValidationError([
        { code: TRADE_VALIDATION_CODES.missingAccount, path: 'accountId' },
      ]);
    }
    const account = accountStore.getAccountBalanceContext(accountId);
    const riskUsd = requestedRiskUsd ?? account.defaultRiskUsd;
    const riskBindingSnapshot: RiskBindingSnapshot | null =
      input.resultKind === TRADE_RESULT_KINDS.r && riskUsd !== null
        ? { kind: 'cash', value: riskUsd, source: 'vault-default' }
        : null;
    if (input.resultKind === TRADE_RESULT_KINDS.r && riskBindingSnapshot === null) {
      throw new TradeValidationError([
        { code: TRADE_VALIDATION_CODES.missingInitialRisk, path: 'riskUsd' },
      ]);
    }
    // The account cost profile now owns the calculation ticks; the legacy
    // instrument profile stays as a fallback for vaults that still rely on it.
    const profile =
      input.execution === null
        ? null
        : (this.accountStore?.getInstrumentCalculationProfile(accountId, input.instrumentId) ??
          this.instrumentStore?.getInstrumentProfile(input.instrumentId) ??
          null);
    if (input.execution !== null && profile === null) {
      throw new TradeValidationError([
        { code: TRADE_VALIDATION_CODES.missingInstrumentProfile, path: 'instrumentProfile' },
      ]);
    }
    const execution =
      input.execution === null || profile === null
        ? null
        : {
            ...input.execution,
            instrumentSnapshot: {
              tickSize: profile.tickSize,
              tickValueUsdPerLot: profile.tickValueUsdPerLot,
            },
          };
    const calculation =
      execution === null ? null : calculateExecutionResult(input.direction, execution);

    const canonicalKind = calculation === null ? input.resultKind : TRADE_RESULT_KINDS.cash;
    const canonicalValue = calculation?.netUsd ?? input.resultValue;
    if (
      canonicalKind === TRADE_RESULT_KINDS.percent &&
      !new Decimal(account.balanceBeforeUsd).isPositive()
    ) {
      throw new TradeValidationError([
        { code: TRADE_VALIDATION_CODES.percentBalanceUnavailable, path: 'resultValue' },
      ]);
    }
    const conversion =
      calculation === null
        ? convertTradeResult(
            canonicalKind,
            canonicalValue,
            account.balanceBeforeUsd,
            riskBindingSnapshot?.value ?? null,
          )
        : {
            conversion: TRADE_RESULT_CONVERSIONS.cash,
            netResultUsd: canonicalValue,
            conversionBalanceUsd: null,
            initialRiskUsd: null,
          };
    return this.tradeUnitOfWork.execute(() => {
      const created = this.tradeStore.createTrade({
        ...tradeInput,
        ...notes,
        execution,
        id,
        account: {
          accountId: account.accountId,
          accountName: account.accountName,
          balanceBeforeUsd: account.balanceBeforeUsd,
          balanceImpactUsd: conversion.netResultUsd,
          conversionBalanceUsd: conversion.conversionBalanceUsd,
          conversion: conversion.conversion,
          initialRiskUsd: conversion.initialRiskUsd,
        },
        inputResultKind: input.resultKind,
        inputResultValue: input.resultValue,
        netResultUsd: conversion.netResultUsd,
        resultKind: canonicalKind,
        resultSource:
          calculation === null ? TRADE_RESULT_SOURCES.manual : TRADE_RESULT_SOURCES.calculated,
        resultValue: canonicalValue,
        riskBindingSnapshot,
        reviewStatus: input.reviewStatus ?? TRADE_REVIEW_STATUSES.unreviewed,
        tagIds,
      });
      if (riskBindingSnapshot !== null) {
        accountStore.saveAccountRiskUsd(account.accountId, riskBindingSnapshot.value);
      }
      return created;
    });
  }

  private requireKnownTagIds(tagIds: readonly string[]): readonly string[] {
    if (tagIds.length === 0) return tagIds;
    if (this.tagStore === undefined) {
      throw new TradeValidationError([{ code: TRADE_VALIDATION_CODES.unknownTag, path: 'tagIds' }]);
    }
    const existing = new Set(this.tagStore.filterExistingTagIds(tagIds));
    const missing = tagIds.filter((tagId) => !existing.has(tagId));
    if (missing.length > 0) {
      throw new TradeValidationError([{ code: TRADE_VALIDATION_CODES.unknownTag, path: 'tagIds' }]);
    }
    return tagIds;
  }
}
