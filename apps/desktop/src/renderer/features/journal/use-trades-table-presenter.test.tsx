import { act, renderHook, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type {
  JournalPageDto,
  JournalPageRequestDto,
  JournalPageRowDto,
  TradePreferencesDto,
} from '../../../shared/desktop-api';
import { i18n } from '../../i18n';
import { MAX_RETAINED_JOURNAL_PAGES } from './journal-page-window';
import { useTradesTablePresenter } from './use-trades-table-presenter';

const TRADE_PREFERENCES: TradePreferencesDto = {
  neutralCostSettings: { includeCommission: false, includeSpread: false },
  neutralRanges: { cash: null, percent: null, r: null },
  riskBinding: null,
  riskPromptDismissed: false,
};

const row = (index: number): JournalPageRowDto => ({
  id: `cash-movement:row-${index}`,
  kind: 'deposit',
  movement: {
    accountId: 'account-1',
    accountName: 'Main',
    amountUsd: '1',
    id: `row-${index}`,
    kind: 'deposit',
    occurredAt: '2026-09-21T12:00:00.000Z',
  },
  occurredAt: '2026-09-21T12:00:00.000Z',
});

const createPage = (index: number): JournalPageDto => ({
  nextCursor: `after-${index}`,
  previousCursor: index === 0 ? null : `before-${index - 1}`,
  rows: [row(index)],
  totalEntryCount: 10,
  unassignedTradeCount: 0,
});

const pageIndexForCursor = (cursor: string | null): number => {
  if (cursor === null) return 0;
  const [kind, value] = cursor.split('-');
  const parsed = Number(value);
  return kind === 'after' ? parsed + 1 : parsed;
};

const createLoadPage = () =>
  vi.fn(async (input: JournalPageRequestDto): Promise<JournalPageDto | null> => {
    return createPage(pageIndexForCursor(input.cursor));
  });

const wrapper = ({ children }: { readonly children: ReactNode }): ReactElement => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

const renderPresenter = (
  loadPage: (input: JournalPageRequestDto) => Promise<JournalPageDto | null>,
) =>
  renderHook(
    () =>
      useTradesTablePresenter({
        accounts: [],
        dataVersion: 1,
        instruments: [],
        layout: undefined,
        loadPage,
        onLayoutChange: () => {},
        tags: [],
        tradePreferences: TRADE_PREFERENCES,
      }),
    { wrapper },
  );

const waitForFirstPage = async (result: {
  readonly current: ReturnType<typeof useTradesTablePresenter>;
}): Promise<void> => {
  await waitFor(() => expect(result.current.entries).toHaveLength(1));
};

describe('useTradesTablePresenter page window', () => {
  it('does not duplicate an in-flight follow-up page request', async () => {
    const loadPage = createLoadPage();
    const { result } = renderPresenter(loadPage);
    await waitForFirstPage(result);

    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    // One request for the initial page and exactly one for the follow-up.
    expect(loadPage).toHaveBeenCalledTimes(2);
  });

  it('retains a bounded window and restores the evicted previous page', async () => {
    const loadPage = createLoadPage();
    const { result } = renderPresenter(loadPage);
    await waitForFirstPage(result);

    for (let index = 1; index < MAX_RETAINED_JOURNAL_PAGES; index += 1) {
      await act(async () => {
        result.current.loadMore();
      });
      await waitFor(() => expect(result.current.entries).toHaveLength(index + 1));
    }
    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.virtualRowStartIndex).toBe(1));

    expect(result.current.entries).toHaveLength(MAX_RETAINED_JOURNAL_PAGES);
    expect(result.current.entries[0]?.id).toBe('cash-movement:row-1');
    expect(result.current.hasPrevious).toBe(true);

    await act(async () => {
      result.current.loadPrevious();
    });
    await waitFor(() => expect(result.current.virtualRowStartIndex).toBe(0));

    expect(result.current.entries.map((entry) => entry.id)).toEqual([
      'cash-movement:row-0',
      'cash-movement:row-1',
      'cash-movement:row-2',
    ]);
    expect(result.current.hasPrevious).toBe(false);
  });
});
