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
  entryNote: null,
  execution: null,
  id,
  instrumentId: symbol,
  instrumentSymbol: symbol,
  resultKind: TRADE_RESULT_KINDS.cash,
  resultSource: TRADE_RESULT_SOURCES.manual,
  resultValue: value,
  reviewNote: null,
  reviewStatus: 'unreviewed',
  riskBindingSnapshot: null,
  tagIds: [],
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

  it('honours the entry kind filter of a deposit-only table selection', () => {
    const query = {
      filters: {
        closedFrom: null,
        closedTo: null,
        entryKinds: ['deposit' as const],
        instrumentIds: null,
        resultKinds: null,
      },
      metric: TRADE_RESULT_KINDS.cash,
      neutralCostSettings: { includeCommission: false, includeSpread: false },
      neutralRange: null,
      now: new Date(),
      period: SUMMARY_PERIODS.all,
    };

    expect(calculateTradeSummary([trade('1', 'EURUSD', '100')], query)).toMatchObject({
      totalResult: null,
      totalTrades: 0,
    });
    expect(
      calculateTradeSummary([trade('1', 'EURUSD', '100')], { ...query, filters: null }),
    ).toMatchObject({
      totalTrades: 1,
    });
  });

  it('filters by the original quick-entry unit', () => {
    const percentTrade: ClosedTrade = {
      ...trade('1', 'EURUSD', '5'),
      inputResultKind: TRADE_RESULT_KINDS.percent,
      netResultUsd: '50',
      resultKind: TRADE_RESULT_KINDS.percent,
    };
    const cashTrade = trade('2', 'EURUSD', '100');
    const query = {
      filters: {
        closedFrom: null,
        closedTo: null,
        instrumentIds: null,
        resultKinds: null,
        resultUnits: [TRADE_RESULT_KINDS.percent],
      },
      metric: TRADE_RESULT_KINDS.cash,
      neutralCostSettings: { includeCommission: false, includeSpread: false },
      neutralRange: null,
      now: new Date(),
      period: SUMMARY_PERIODS.all,
    };

    expect(calculateTradeSummary([percentTrade, cashTrade], query).totalTrades).toBe(1);
  });

  it('applies inclusive USD bounds to the authoritative result', () => {
    const withUsd = (id: string, value: string): ClosedTrade => ({
      ...trade(id, 'EURUSD', value),
      netResultUsd: value,
    });
    const query = {
      filters: {
        closedFrom: null,
        closedTo: null,
        instrumentIds: null,
        netResultBounds: { maximum: '100', minimum: '-50' },
        resultKinds: null,
      },
      metric: TRADE_RESULT_KINDS.cash,
      neutralCostSettings: { includeCommission: false, includeSpread: false },
      neutralRange: null,
      now: new Date(),
      period: SUMMARY_PERIODS.all,
    };

    expect(
      calculateTradeSummary([withUsd('1', '-50'), withUsd('2', '100')], query).totalTrades,
    ).toBe(2);
    expect(calculateTradeSummary([withUsd('3', '100.0001')], query).totalTrades).toBe(0);
  });

  it('matches an exact USD value when both bounds carry the same amount', () => {
    const withUsd = (id: string, value: string): ClosedTrade => ({
      ...trade(id, 'EURUSD', value),
      netResultUsd: value,
    });
    const query = {
      filters: {
        closedFrom: null,
        closedTo: null,
        instrumentIds: null,
        netResultBounds: { maximum: '50', minimum: '50' },
        resultKinds: null,
      },
      metric: TRADE_RESULT_KINDS.cash,
      neutralCostSettings: { includeCommission: false, includeSpread: false },
      neutralRange: null,
      now: new Date(),
      period: SUMMARY_PERIODS.all,
    };

    expect(calculateTradeSummary([withUsd('1', '50.00')], query).totalTrades).toBe(1);
    expect(calculateTradeSummary([withUsd('2', '50.01')], query).totalTrades).toBe(0);
  });
});
