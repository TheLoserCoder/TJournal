import { describe, expect, it } from 'vitest';

import type { JournalPageDto, JournalPageRowDto } from '../../../shared/desktop-api';
import {
  appendJournalPage,
  closeJournalPageWindowBoundary,
  createJournalPageWindow,
  getJournalPageWindowRows,
  MAX_RETAINED_JOURNAL_PAGES,
  prependJournalPage,
} from './journal-page-window';

const row = (id: string): JournalPageRowDto => ({
  id: `cash-movement:${id}`,
  kind: 'deposit',
  movement: {
    accountId: 'account-1',
    accountName: 'Main',
    amountUsd: '1',
    id,
    kind: 'deposit',
    occurredAt: '2026-09-21T12:00:00.000Z',
  },
  occurredAt: '2026-09-21T12:00:00.000Z',
});

const page = (index: number): JournalPageDto => ({
  nextCursor: `after-${index}`,
  previousCursor: index === 0 ? null : `before-${index}`,
  rows: [row(`row-${index}`)],
  totalEntryCount: 10,
  unassignedTradeCount: 0,
});

describe('journal page window', () => {
  it('drops old rows and advances their absolute start index', () => {
    let window = createJournalPageWindow(page(0));
    for (let index = 1; index <= MAX_RETAINED_JOURNAL_PAGES; index += 1) {
      window = appendJournalPage(window, page(index));
    }

    expect(window.pages).toHaveLength(MAX_RETAINED_JOURNAL_PAGES);
    expect(window.rowStartIndex).toBe(1);
    expect(getJournalPageWindowRows(window).map((item) => item.id)).toEqual([
      'cash-movement:row-1',
      'cash-movement:row-2',
      'cash-movement:row-3',
    ]);
  });

  it('restores a previous page and drops the far end of the window', () => {
    const deepWindow = {
      pages: [page(2), page(3), page(4)],
      rowStartIndex: 2,
    };

    const restored = prependJournalPage(deepWindow, page(1));

    expect(restored.pages).toHaveLength(MAX_RETAINED_JOURNAL_PAGES);
    expect(restored.rowStartIndex).toBe(1);
    expect(getJournalPageWindowRows(restored).map((item) => item.id)).toEqual([
      'cash-movement:row-1',
      'cash-movement:row-2',
      'cash-movement:row-3',
    ]);
  });

  it('closes a false-positive cursor without dropping retained rows', () => {
    const window = createJournalPageWindow(page(0));

    const closed = closeJournalPageWindowBoundary(window, 'next');

    expect(closed.pages[0]?.nextCursor).toBeNull();
    expect(getJournalPageWindowRows(closed)).toEqual(getJournalPageWindowRows(window));
  });
});
