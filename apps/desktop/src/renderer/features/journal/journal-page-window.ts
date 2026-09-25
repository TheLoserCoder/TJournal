import type { JournalPageDto, JournalPageRowDto } from '../../../shared/desktop-api';

export const MAX_RETAINED_JOURNAL_PAGES = 3;

export interface JournalPageWindow {
  readonly pages: readonly JournalPageDto[];
  readonly rowStartIndex: number;
}

export const createJournalPageWindow = (page: JournalPageDto): JournalPageWindow => ({
  pages: [page],
  rowStartIndex: 0,
});

export const getJournalPageWindowRows = (window: JournalPageWindow): readonly JournalPageRowDto[] =>
  window.pages.flatMap((page) => page.rows);

export const appendJournalPage = (
  window: JournalPageWindow,
  page: JournalPageDto,
): JournalPageWindow => {
  const pages = [...window.pages, page];
  const droppedPages = pages.slice(0, -MAX_RETAINED_JOURNAL_PAGES);
  return {
    pages: pages.slice(-MAX_RETAINED_JOURNAL_PAGES),
    rowStartIndex:
      window.rowStartIndex +
      droppedPages.reduce((count, droppedPage) => count + droppedPage.rows.length, 0),
  };
};

export const prependJournalPage = (
  window: JournalPageWindow,
  page: JournalPageDto,
): JournalPageWindow => ({
  pages: [page, ...window.pages].slice(0, MAX_RETAINED_JOURNAL_PAGES),
  rowStartIndex: Math.max(0, window.rowStartIndex - page.rows.length),
});

export const closeJournalPageWindowBoundary = (
  window: JournalPageWindow,
  boundary: 'next' | 'previous',
): JournalPageWindow => ({
  ...window,
  pages: window.pages.map((page, index) => {
    if (boundary === 'previous' && index === 0) return { ...page, previousCursor: null };
    if (boundary === 'next' && index === window.pages.length - 1) {
      return { ...page, nextCursor: null };
    }
    return page;
  }),
});
