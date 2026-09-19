import { describe, expect, it } from 'vitest';

import { calculateExecutionResult } from './calculate-execution-result';
import { EXIT_ALLOCATION_KINDS, TRADE_DIRECTIONS, type TradeExecution } from './trade';

const EXECUTION: TradeExecution = {
  commissionUsd: '5',
  entryPrice: '100',
  exits: [
    {
      allocationKind: EXIT_ALLOCATION_KINDS.percent,
      allocationValue: '25',
      exitPrice: '102',
      id: 'exit-1',
      order: 0,
      reportedResultKind: null,
      reportedResultValue: null,
    },
    {
      allocationKind: EXIT_ALLOCATION_KINDS.percent,
      allocationValue: '75',
      exitPrice: '104',
      id: 'exit-2',
      order: 1,
      reportedResultKind: null,
      reportedResultValue: null,
    },
  ],
  instrumentSnapshot: { tickSize: '0.5', tickValueUsdPerLot: '10' },
  quantityLots: '2',
  spreadTicks: '1',
  stopLossPrice: '99',
};

describe('calculateExecutionResult', () => {
  it('calculates a long with exits, spread and commission exactly', () => {
    expect(calculateExecutionResult(TRADE_DIRECTIONS.long, EXECUTION)).toEqual({
      grossUsd: '140',
      netUsd: '115',
      spreadCostUsd: '20',
    });
  });

  it('reverses the price delta for a short', () => {
    const execution = {
      ...EXECUTION,
      exits: EXECUTION.exits.map((exit) => ({
        ...exit,
        exitPrice: exit.exitPrice === '102' ? '98' : '96',
      })),
    };
    expect(calculateExecutionResult(TRADE_DIRECTIONS.short, execution).netUsd).toBe('115');
  });
});
