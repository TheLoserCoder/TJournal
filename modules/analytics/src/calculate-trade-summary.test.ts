import { describe, expect, it } from 'vitest';

import {
  TRADE_DIRECTIONS,
  TRADE_RESULT_KINDS,
  TRADE_RESULT_SOURCES,
  type ClosedTrade,
} from '@tjournal/trade';
import { calculateTradeSummary, SUMMARY_PERIODS } from './calculate-trade-summary';

const trade = (id: string, symbol: string, value: string): ClosedTrade => ({
  closedAt: '2026-09-10T12:00:00.000Z',
  direction: TRADE_DIRECTIONS.long,
  execution: null,
  id,
  instrumentId: symbol,
  instrumentSymbol: symbol,
  resultKind: TRADE_RESULT_KINDS.cash,
  resultSource: TRADE_RESULT_SOURCES.manual,
  resultValue: value,
  riskBindingSnapshot: null,
});

describe('calculateTradeSummary', () => {
  it('calculates neutral-aware winrate and stable best/worst instruments', () => {
    const result = calculateTradeSummary(
      [
        trade('1', 'EURUSD', '100'),
        trade('2', 'EURUSD', '-20'),
        trade('3', 'BTCUSD', '-50'),
        trade('4', 'AAPL', '0'),
      ],
      {
        filters: null,
        metric: TRADE_RESULT_KINDS.cash,
        neutralCostSettings: { includeCommission: false, includeSpread: false },
        neutralRange: { lower: '-1', upper: '1' },
        now: new Date('2026-09-13T12:00:00'),
        period: SUMMARY_PERIODS.currentWeek,
      },
    );
    expect(result).toMatchObject({
      bestInstrument: 'EURUSD',
      losingTrades: 2,
      neutralTrades: 1,
      totalResult: '30',
      winningTrades: 1,
      worstInstrument: 'BTCUSD',
    });
    expect(result.winRate).toBe('33.333333333333333333');
  });

  it('uses exact zero as the default break-even range', () => {
    expect(
      calculateTradeSummary([trade('1', 'EURUSD', '0')], {
        filters: null,
        metric: TRADE_RESULT_KINDS.cash,
        neutralCostSettings: { includeCommission: false, includeSpread: false },
        neutralRange: null,
        now: new Date(),
        period: SUMMARY_PERIODS.all,
      }),
    ).toMatchObject({ losingTrades: 0, neutralTrades: 1, winRate: null, winningTrades: 0 });
  });

  it('updates the worst instrument when a trade changes to a negative value', () => {
    const query = {
      filters: null,
      metric: TRADE_RESULT_KINDS.cash,
      neutralCostSettings: { includeCommission: false, includeSpread: false },
      neutralRange: null,
      now: new Date('2026-09-13T12:00:00.000Z'),
      period: SUMMARY_PERIODS.all,
    } as const;

    expect(calculateTradeSummary([trade('1', 'EURUSD', '10')], query).worstInstrument).toBeNull();
    expect(calculateTradeSummary([trade('1', 'EURUSD', '-10')], query).worstInstrument).toBe(
      'EURUSD',
    );
  });

  it('classifies calculated trades from the authoritative net USD result', () => {
    const calculatedTrade: ClosedTrade = {
      ...trade('calculated', 'EURUSD', '-6'),
      execution: {
        commissionUsd: '5',
        entryPrice: '100',
        exits: [
          {
            allocationKind: 'lots',
            allocationValue: '1',
            exitPrice: '100',
            id: 'exit',
            order: 0,
            reportedResultKind: null,
            reportedResultValue: null,
          },
        ],
        instrumentSnapshot: { tickSize: '1', tickValueUsdPerLot: '1' },
        quantityLots: '1',
        spreadTicks: '1',
        stopLossPrice: null,
      },
      resultSource: TRADE_RESULT_SOURCES.calculated,
    };
    const defaults = calculateTradeSummary([calculatedTrade], {
      filters: null,
      metric: TRADE_RESULT_KINDS.cash,
      neutralCostSettings: { includeCommission: false, includeSpread: false },
      neutralRange: null,
      now: new Date(),
      period: SUMMARY_PERIODS.all,
    });
    const withCosts = calculateTradeSummary([calculatedTrade], {
      filters: null,
      metric: TRADE_RESULT_KINDS.cash,
      neutralCostSettings: { includeCommission: true, includeSpread: true },
      neutralRange: null,
      now: new Date(),
      period: SUMMARY_PERIODS.all,
    });

    expect(defaults).toMatchObject({ losingTrades: 1, neutralTrades: 0, totalResult: '-6' });
    expect(withCosts).toMatchObject({ losingTrades: 1, neutralTrades: 0, totalResult: '-6' });
  });
});
