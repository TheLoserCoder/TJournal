import type { JournalPageRowDto } from '../../../shared/desktop-api';

/** One rendered journal row: a trade or a cash movement, as returned by the bounded reader. */
export type JournalEntryRow = JournalPageRowDto;
