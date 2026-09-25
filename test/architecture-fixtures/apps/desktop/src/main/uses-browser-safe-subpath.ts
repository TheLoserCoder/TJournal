// Intentional violation: Electron main requires compiled module entries, not browser-safe TypeScript subpaths.
import { MAX_TRADE_NOTE_CODE_POINTS } from '@tjournal/trade/note-rules';

export const noteLimit = MAX_TRADE_NOTE_CODE_POINTS;
