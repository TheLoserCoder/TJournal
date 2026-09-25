import type { JournalTablePage, JournalTableQuery } from '@tjournal/trade';

import type { JournalPageDto, JournalPageRequestDto } from '../shared/desktop-api';

/** Transport mapping: module read model -> serializable page DTO. */
export const toJournalPageDto = (page: JournalTablePage): JournalPageDto => ({
  nextCursor: page.nextCursor,
  previousCursor: page.previousCursor,
  rows: page.rows.map((row) =>
    row.kind === 'trade'
      ? {
          id: row.id,
          kind: 'trade' as const,
          occurredAt: row.occurredAt,
          trade: row.trade,
        }
      : {
          id: row.id,
          kind: row.movement.kind,
          movement: row.movement,
          occurredAt: row.occurredAt,
        },
  ),
  totalEntryCount: page.totalEntryCount,
  unassignedTradeCount: page.unassignedTradeCount,
});

export const toJournalTableQuery = (request: JournalPageRequestDto): JournalTableQuery => ({
  cursor: request.cursor,
  filters: request.filters,
  includeCashMovements: request.includeCashMovements,
  limit: request.limit,
  sort: request.sort,
});
