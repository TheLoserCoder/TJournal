import { describe, expect, it } from 'vitest';

import type { CashMovementDto, TradeDto } from '../../../shared/desktop-api';
import { toJournalEntryRows } from './journal-entry-row';

const trade = {
  account: { accountId: 'account-1', accountName: 'Main' },
  closedAt: '2026-09-16T10:00:00.000Z',
  direction: 'long',
  id: 'trade-1',
  instrumentId: 'instrument-1',
  instrumentSymbol: 'EURUSD',
  resultKind: 'cash',
  resultValue: '10',
} as TradeDto;

const movement = {
  accountId: 'account-1',
  accountName: 'Main',
  amountUsd: '100',
  id: 'movement-1',
  kind: 'deposit',
  occurredAt: '2026-09-16T11:00:00.000Z',
} as CashMovementDto;

describe('toJournalEntryRows', () => {
  it('keeps deposits and withdrawals in the same table row model with stable distinct ids', () => {
    expect(toJournalEntryRows([trade], [movement], true)).toEqual([
      expect.objectContaining({ id: 'trade:trade-1', kind: 'trade', trade }),
      expect.objectContaining({ id: 'cash-movement:movement-1', kind: 'deposit', movement }),
    ]);
  });

  it('omits cash movements without removing trades when the table setting hides them', () => {
    expect(toJournalEntryRows([trade], [movement], false)).toEqual([
      expect.objectContaining({ id: 'trade:trade-1', kind: 'trade', trade }),
    ]);
  });
});
