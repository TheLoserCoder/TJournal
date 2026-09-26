import Decimal from 'decimal.js';

import {
  EXIT_ALLOCATION_KINDS,
  TRADE_RESULT_KINDS,
  type TradeDirection,
  type TradeExecution,
  type TradeExecutionInput,
  type TradePreferences,
  type TradeResultKind,
} from './trade';
import { isTradeNoteWithinLimit, normalizeTradeNotes } from './trade-note-rules';

export {
  isTradeNoteWithinLimit,
  MAX_TRADE_NOTE_CODE_POINTS,
  normalizeTradeNotes,
} from './trade-note-rules';

export const TRADE_VALIDATION_CODES = {
  allocationMismatch: 'allocation-mismatch',
  inconsistentAllocation: 'inconsistent-allocation',
  invalidDecimal: 'invalid-decimal',
  invalidDate: 'invalid-date',
  missingDirection: 'missing-direction',
  missingAccount: 'missing-account',
  missingInitialRisk: 'missing-initial-risk',
  missingInstrumentProfile: 'missing-instrument-profile',
  mustBeNonNegative: 'must-be-non-negative',
  mustBePositive: 'must-be-positive',
  neutralRangeInvalid: 'neutral-range-invalid',
  noteTooLong: 'note-too-long',
  percentBalanceUnavailable: 'percent-balance-unavailable',
  unknownTag: 'unknown-tag',
  unresolvedLegacyResult: 'unresolved-legacy-result',
} as const;
export type TradeValidationIssueCode =
  (typeof TRADE_VALIDATION_CODES)[keyof typeof TRADE_VALIDATION_CODES];

export interface TradeValidationIssue {
  readonly code: TradeValidationIssueCode;
  readonly path: string;
}

export class TradeValidationError extends Error {
  public constructor(public readonly issues: readonly TradeValidationIssue[]) {
    super('Trade validation failed.');
    this.name = 'TradeValidationError';
  }
}

const tryParseDecimal = (value: string): Decimal | null => {
  try {
    const decimal = new Decimal(value);
    return decimal.isFinite() ? decimal : null;
  } catch {
    return null;
  }
};

const parseDecimal = (
  value: string,
  path: string,
  issues: TradeValidationIssue[],
): Decimal | null => {
  const decimal = tryParseDecimal(value);
  if (decimal === null) issues.push({ code: TRADE_VALIDATION_CODES.invalidDecimal, path });
  return decimal;
};

const requirePositive = (
  value: string,
  path: string,
  issues: TradeValidationIssue[],
): Decimal | null => {
  const decimal = parseDecimal(value, path, issues);
  if (decimal !== null && !decimal.greaterThan(0)) {
    issues.push({ code: TRADE_VALIDATION_CODES.mustBePositive, path });
  }
  return decimal;
};

const requireNonNegative = (value: string, path: string, issues: TradeValidationIssue[]): void => {
  const decimal = parseDecimal(value, path, issues);
  if (decimal !== null && decimal.isNegative()) {
    issues.push({ code: TRADE_VALIDATION_CODES.mustBeNonNegative, path });
  }
};

/**
 * Normalises a user-entered decimal: surrounding whitespace is dropped and a
 * comma separator becomes a dot. The result is parsed as a whole, so a partial
 * numeric prefix like `12abc` is never accepted.
 */
export const normalizeDecimalInput = (value: string): string => value.trim().replace(',', '.');

/** True when the whole input is a finite Decimal strictly greater than zero. */
export const isPositiveDecimalInput = (value: string): boolean => {
  const normalized = normalizeDecimalInput(value);
  if (normalized === '') return false;
  const decimal = tryParseDecimal(normalized);
  return decimal !== null && decimal.greaterThan(0);
};

export const validateTradeInput = (input: {
  readonly closedAt: string;
  readonly direction: TradeDirection | null;
  readonly execution: TradeExecution | TradeExecutionInput | null;
  readonly resultKind: TradeResultKind;
  readonly resultValue: string;
  readonly entryNote?: string | null;
  readonly reviewNote?: string | null;
  readonly accountId?: string | null;
  readonly riskUsd?: string | null;
}): void => {
  const issues: TradeValidationIssue[] = [];
  const normalizedNotes = normalizeTradeNotes(input);
  for (const [path, note] of [
    ['entryNote', normalizedNotes.entryNote],
    ['reviewNote', normalizedNotes.reviewNote],
  ] as const) {
    if (note !== null && !isTradeNoteWithinLimit(note)) {
      issues.push({ code: TRADE_VALIDATION_CODES.noteTooLong, path });
    }
  }
  if (Number.isNaN(Date.parse(input.closedAt))) {
    issues.push({ code: TRADE_VALIDATION_CODES.invalidDate, path: 'closedAt' });
  }
  parseDecimal(input.resultValue, 'resultValue', issues);
  if (input.accountId !== undefined && input.accountId === null) {
    issues.push({ code: TRADE_VALIDATION_CODES.missingAccount, path: 'accountId' });
  }
  if (input.direction === null) {
    issues.push({ code: TRADE_VALIDATION_CODES.missingDirection, path: 'direction' });
  }

  const execution = input.execution;
  if (execution !== null) {
    requirePositive(execution.entryPrice, 'execution.entryPrice', issues);
    requirePositive(execution.quantityLots, 'execution.quantityLots', issues);
    requireNonNegative(execution.commissionUsd, 'execution.commissionUsd', issues);
    requireNonNegative(execution.spreadTicks, 'execution.spreadTicks', issues);
    if (execution.stopLossPrice !== null) {
      requirePositive(execution.stopLossPrice, 'execution.stopLossPrice', issues);
    }

    const allocationKind = execution.exits[0]?.allocationKind;
    let allocationTotal = new Decimal(0);
    execution.exits.forEach((exit, index) => {
      const prefix = `execution.exits.${index}`;
      requirePositive(exit.exitPrice, `${prefix}.exitPrice`, issues);
      const allocation = requirePositive(exit.allocationValue, `${prefix}.allocationValue`, issues);
      if (allocation !== null) allocationTotal = allocationTotal.plus(allocation);
      if (exit.allocationKind !== allocationKind) {
        issues.push({
          code: TRADE_VALIDATION_CODES.inconsistentAllocation,
          path: `${prefix}.allocationKind`,
        });
      }
      if (exit.reportedResultValue !== null) {
        parseDecimal(exit.reportedResultValue, `${prefix}.reportedResultValue`, issues);
      }
    });
    const expected =
      allocationKind === EXIT_ALLOCATION_KINDS.percent
        ? new Decimal(100)
        : new Decimal(execution.quantityLots);
    if (execution.exits.length === 0 || !allocationTotal.equals(expected)) {
      issues.push({ code: TRADE_VALIDATION_CODES.allocationMismatch, path: 'execution.exits' });
    }
  }

  if (input.resultKind === TRADE_RESULT_KINDS.r) {
    parseDecimal(input.resultValue, 'resultValue', issues);
    if (input.riskUsd !== undefined && input.riskUsd !== null) {
      requirePositive(input.riskUsd, 'riskUsd', issues);
    }
  }
  if (issues.length > 0) throw new TradeValidationError(issues);
};

export const validateTradePreferences = (preferences: TradePreferences): void => {
  const issues: TradeValidationIssue[] = [];
  if (preferences.riskBinding !== null) {
    requirePositive(preferences.riskBinding.value, 'riskBinding.value', issues);
  }
  for (const [kind, range] of Object.entries(preferences.neutralRanges)) {
    if (range === null) continue;
    const lower = parseDecimal(range.lower, `neutralRanges.${kind}.lower`, issues);
    const upper = parseDecimal(range.upper, `neutralRanges.${kind}.upper`, issues);
    if (lower !== null && upper !== null && lower.greaterThan(upper)) {
      issues.push({
        code: TRADE_VALIDATION_CODES.neutralRangeInvalid,
        path: `neutralRanges.${kind}`,
      });
    }
  }
  if (issues.length > 0) throw new TradeValidationError(issues);
};
