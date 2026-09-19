import { describe, expect, it } from 'vitest';

import { TRADE_RESULT_KINDS } from './trade';
import { convertTradeResult } from './convert-trade-result';

describe('convertTradeResult', () => {
  it('keeps USD input as the authoritative exact result', () => {
    expect(convertTradeResult(TRADE_RESULT_KINDS.cash, '-12.500', '1000', null)).toMatchObject({
      conversion: 'cash',
      netResultUsd: '-12.5',
      conversionBalanceUsd: null,
      initialRiskUsd: null,
    });
  });

  it('converts percentage from the saved current account base', () => {
    expect(convertTradeResult(TRADE_RESULT_KINDS.percent, '2.5', '1250', null)).toMatchObject({
      conversion: 'percent-of-balance',
      netResultUsd: '31.25',
      conversionBalanceUsd: '1250',
    });
  });

  it('converts signed R from a positive saved risk value', () => {
    expect(convertTradeResult(TRADE_RESULT_KINDS.r, '-1.5', '1250', '40')).toMatchObject({
      conversion: 'r-cash-risk',
      netResultUsd: '-60',
      initialRiskUsd: '40',
    });
  });
});
