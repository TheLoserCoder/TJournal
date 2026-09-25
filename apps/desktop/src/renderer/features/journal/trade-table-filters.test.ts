import { describe, expect, it } from 'vitest';

import type { TradeDto } from '../../../shared/desktop-api';
import { TRADE_RESULT_KINDS, TRADE_RESULT_SOURCES } from '@tjournal/trade';

import { getJournalEntryAmountUsd } from './trade-table-filters';
import type { JournalEntryRow } from './journal-entry-row';

const TEST_REQUIRED_TRADE: TradeDto = {
  closedAt: '2026-09-21T12:00:00.000Z',
  direction: 'long',
  entryNote: null,
  execution: null,
  id: 'trade-1',
  instrumentId: 'instrument-1',
  instrumentSymbol: 'EURUSD',
  resultKind: TRADE_RESULT_KINDS.cash,
  resultSource: TRADE_RESULT_SOURCES.manual,
  resultValue: '10',
  reviewNote: null,
  reviewStatus: 'unreviewed',
  riskBindingSnapshot: null,
  tagIds: [],
};

const tradeRow = (trade: TradeDto): JournalEntryRow => ({
  id: `trade:${trade.id}`,
  kind: 'trade',
  occurredAt: trade.closedAt,
  trade,
});

describe('getJournalEntryAmountUsd', () => {
  it('prefers the canonical USD result and falls back to the account impact', () => {
    expect(getJournalEntryAmountUsd(tradeRow({ ...TEST_REQUIRED_TRADE, netResultUsd: '25' }))).toBe(
      '25',
    );
    expect(
      getJournalEntryAmountUsd(
        tradeRow({
          ...TEST_REQUIRED_TRADE,
          account: {
            accountId: 'account-1',
            accountName: 'Main',
            balanceBeforeUsd: '1000',
            balanceImpactUsd: '12.5',
            conversion: 'cash',
          },
        }),
      ),
    ).toBe('12.5');
    expect(getJournalEntryAmountUsd(tradeRow(TEST_REQUIRED_TRADE))).toBeNull();
  });

  it('signs cash movements from their kind', () => {
    expect(
      getJournalEntryAmountUsd({
        id: 'cash-movement:deposit-1',
        kind: 'deposit',
        movement: {
          accountId: 'account-1',
          accountName: 'Main',
          amountUsd: '100',
          id: 'deposit-1',
          kind: 'deposit',
          occurredAt: '2026-09-21T12:00:00.000Z',
        },
        occurredAt: '2026-09-21T12:00:00.000Z',
      }),
    ).toBe('100');
    expect(
      getJournalEntryAmountUsd({
        id: 'cash-movement:withdrawal-1',
        kind: 'withdrawal',
        movement: {
          accountId: 'account-1',
          accountName: 'Main',
          amountUsd: '40',
          id: 'withdrawal-1',
          kind: 'withdrawal',
          occurredAt: '2026-09-21T12:00:00.000Z',
        },
        occurredAt: '2026-09-21T12:00:00.000Z',
      }),
    ).toBe('-40');
  });
});
