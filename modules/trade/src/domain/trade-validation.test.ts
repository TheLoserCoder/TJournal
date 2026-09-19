import { describe, expect, it } from 'vitest';

import { EXIT_ALLOCATION_KINDS, TRADE_DIRECTIONS, TRADE_RESULT_KINDS } from './trade';
import { TradeValidationError, validateTradeInput } from './trade-validation';

describe('validateTradeInput', () => {
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
