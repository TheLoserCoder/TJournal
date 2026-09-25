export const MAX_TRADE_NOTE_CODE_POINTS = 4_000;

export interface TradeNoteFields {
  readonly entryNote?: string | null;
  readonly reviewNote?: string | null;
}

export interface NormalizedTradeNotes {
  readonly entryNote: string | null;
  readonly reviewNote: string | null;
}

const normalizeNote = (note: string | null | undefined): string | null => {
  const normalized = note?.trim() ?? '';
  return normalized === '' ? null : normalized;
};

export const normalizeTradeNotes = (notes: TradeNoteFields): NormalizedTradeNotes => ({
  entryNote: normalizeNote(notes.entryNote),
  reviewNote: normalizeNote(notes.reviewNote),
});

export const isTradeNoteWithinLimit = (note: string): boolean => {
  const codePoints = note[Symbol.iterator]();
  let remainingCodePoints = MAX_TRADE_NOTE_CODE_POINTS;
  while (remainingCodePoints > 0) {
    if (codePoints.next().done) return true;
    remainingCodePoints -= 1;
  }
  return codePoints.next().done === true;
};
