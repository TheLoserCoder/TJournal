import { describe, expect, it } from 'vitest';

import { EXIT_ALLOCATION_KINDS, TRADE_DIRECTIONS, TRADE_RESULT_KINDS } from './trade';
import {
  isTradeNoteWithinLimit,
  MAX_TRADE_NOTE_CODE_POINTS,
  normalizeTradeNotes,
  TRADE_VALIDATION_CODES,
  TradeValidationError,
  validateTradeInput,
} from './trade-validation';

const validInput = {
  closedAt: '2026-09-13T10:00:00.000Z',
  direction: TRADE_DIRECTIONS.long,
  execution: null,
  resultKind: TRADE_RESULT_KINDS.cash,
  resultValue: '10',
} as const;

describe('validateTradeInput', () => {
  it('trims note edges, maps blank notes to null, and preserves internal line breaks', () => {
    expect(
      normalizeTradeNotes({
        entryNote: '  reason one\nreason two  ',
        reviewNote: ' \t\n ',
      }),
    ).toEqual({ entryNote: 'reason one\nreason two', reviewNote: null });
  });

  it('limits each normalized note by Unicode code points', () => {
    const maximumNote = '😀'.repeat(MAX_TRADE_NOTE_CODE_POINTS);
    expect(isTradeNoteWithinLimit(maximumNote)).toBe(true);
    expect(isTradeNoteWithinLimit(`${maximumNote}😀`)).toBe(false);
    expect(() =>
      validateTradeInput({ ...validInput, reviewNote: `${maximumNote}😀` }),
    ).toThrowError(
      expect.objectContaining({
        issues: [{ code: TRADE_VALIDATION_CODES.noteTooLong, path: 'reviewNote' }],
      }),
    );
  });

  it('accepts signed R results and a 25/75 allocation', () => {
    expect(() =>
      validateTradeInput({
        closedAt: '2026-09-13T10:00:00.000Z',
        direction: TRADE_DIRECTIONS.long,
        execution: {
          commissionUsd: '0',
          entryPrice: '100',
          exits: ['25', '75'].map((allocationValue, order) => ({
            allocationKind: EXIT_ALLOCATION_KINDS.percent,
            allocationValue,
            exitPrice: '101',
            id: `exit-${order}`,
            order,
            reportedResultKind: null,
            reportedResultValue: null,
          })),
          quantityLots: '1',
          spreadTicks: '0',
          stopLossPrice: null,
        },
        resultKind: TRADE_RESULT_KINDS.r,
        resultValue: '-1000',
      }),
    ).not.toThrow();
  });

  it('rejects allocations that do not close the position', () => {
    expect(() =>
      validateTradeInput({
        closedAt: '2026-09-13T10:00:00.000Z',
        direction: TRADE_DIRECTIONS.short,
        execution: {
          commissionUsd: '0',
          entryPrice: '100',
          quantityLots: '1',
          spreadTicks: '0',
          stopLossPrice: null,
          exits: [
            {
              allocationKind: EXIT_ALLOCATION_KINDS.percent,
              allocationValue: '25',
              exitPrice: '99',
              id: 'exit',
              order: 0,
              reportedResultKind: null,
              reportedResultValue: null,
            },
          ],
        },
        resultKind: TRADE_RESULT_KINDS.cash,
        resultValue: '10',
      }),
    ).toThrow(TradeValidationError);
  });
});
