import Decimal from 'decimal.js';

import {
  EXIT_ALLOCATION_KINDS,
  TRADE_DIRECTIONS,
  type TradeDirection,
  type TradeExecution,
} from './trade';

const PERCENT_TOTAL = new Decimal(100);

export interface ExecutionCalculation {
  readonly grossUsd: string;
  readonly netUsd: string;
  readonly spreadCostUsd: string;
}

export const calculateExecutionResult = (
  direction: TradeDirection,
  execution: TradeExecution,
): ExecutionCalculation => {
  const entry = new Decimal(execution.entryPrice);
  const totalLots = new Decimal(execution.quantityLots);
  const tickSize = new Decimal(execution.instrumentSnapshot.tickSize);
  const tickValue = new Decimal(execution.instrumentSnapshot.tickValueUsdPerLot);
  const directionFactor = direction === TRADE_DIRECTIONS.long ? new Decimal(1) : new Decimal(-1);

  const gross = execution.exits.reduce((sum, exit) => {
    const lots =
      exit.allocationKind === EXIT_ALLOCATION_KINDS.percent
        ? totalLots.mul(exit.allocationValue).div(PERCENT_TOTAL)
        : new Decimal(exit.allocationValue);
    const priceTicks = new Decimal(exit.exitPrice).minus(entry).div(tickSize).mul(directionFactor);
    return sum.plus(priceTicks.mul(tickValue).mul(lots));
  }, new Decimal(0));
  const spreadCost = new Decimal(execution.spreadTicks).mul(tickValue).mul(totalLots);
  const net = gross.minus(spreadCost).minus(execution.commissionUsd);

  return {
    grossUsd: gross.toString(),
    netUsd: net.toString(),
    spreadCostUsd: spreadCost.toString(),
  };
};
