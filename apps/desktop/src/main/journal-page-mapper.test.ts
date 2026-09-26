import { describe, expect, it } from 'vitest';

import type { JournalTablePage, JournalTableQuery } from '@tjournal/trade';

import type { JournalPageRequestDto } from '../shared/desktop-api';
import { toJournalPageDto, toJournalTableQuery } from './journal-page-mapper';

describe('journal page mapping', () => {
  it('maps module rows to serializable page rows', () => {
    const page: JournalTablePage = {
      nextCursor: 'cursor-1',
      previousCursor: 'cursor-0',
      rows: [
        {
          id: 'trade:trade-1',
          kind: 'trade',
          occurredAt: '2026-09-21T12:00:00.000Z',
          trade: {
            closedAt: '2026-09-21T12:00:00.000Z',
            commissionUsd: null,
            direction: 'long',
            entryPrice: null,
            exitCount: 0,
            hasEntryNote: false,
            hasReviewNote: false,
            id: 'trade-1',
            instrumentId: 'instrument-1',
            instrumentSymbol: 'EURUSD',
            netResultUsd: '10',
            quantityLots: null,
            resultKind: 'cash',
            resultSource: 'manual',
            resultValue: '10',
            reviewStatus: 'unreviewed',
            riskBindingSnapshot: null,
            spreadTicks: null,
            stopLossPrice: null,
            tagIds: [],
          },
        },
        {
          id: 'cash-movement:movement-1',
          kind: 'movement',
          occurredAt: '2026-09-20T12:00:00.000Z',
          movement: {
            accountId: 'account-1',
            accountName: 'Main',
            amountUsd: '50',
            id: 'movement-1',
            kind: 'withdrawal',
            occurredAt: '2026-09-20T12:00:00.000Z',
          },
        },
      ],
      totalEntryCount: 2,
      unassignedTradeCount: 0,
    };

    const dto = toJournalPageDto(page);
    expect(dto.nextCursor).toBe('cursor-1');
    expect(dto.previousCursor).toBe('cursor-0');
    expect(dto.totalEntryCount).toBe(2);
    expect(dto.unassignedTradeCount).toBe(0);
    expect(dto.rows[0]).toMatchObject({ id: 'trade:trade-1', kind: 'trade' });
    expect(dto.rows[1]).toMatchObject({ id: 'cash-movement:movement-1', kind: 'withdrawal' });
  });

  it('passes the validated request through to the reader query', () => {
    const request: JournalPageRequestDto = {
      cursor: 'cursor-1',
      filters: {
        accountIds: ['account-1'],
        categories: [],
        closedFromDate: null,
        closedToDate: null,
        detailBounds: null,
        entryKinds: ['long'],
        includeUntagged: false,
        includeUnassigned: false,
        instrumentIds: [],
        notePresence: [],
        occurredFrom: null,
        occurredTo: null,
        resultBounds: null,
        resultUnits: [],
        reviewStatuses: [],
        tagIds: [],
        textQuery: null,
      },
      includeCashMovements: false,
      limit: 50,
      sort: { direction: 'asc', field: 'result' },
    };

    const query: JournalTableQuery = toJournalTableQuery(request);
    expect(query).toEqual(request);
  });
});
