import { AppError } from '@tjournal/platform-errors';
import type {
  JournalTableSort,
  JournalTableSortDirection,
  JournalTableSortField,
} from '@tjournal/trade';

const CURSOR_VERSION = 2;

export type CursorValue = string | number | null;
export type CursorTraversal = 'after' | 'before';

interface CursorPayload {
  readonly direction: JournalTableSortDirection;
  readonly field: JournalTableSortField;
  readonly traversal: CursorTraversal;
  readonly v: number;
  readonly values: readonly CursorValue[];
}

export const encodeCursor = (
  sort: JournalTableSort,
  values: readonly CursorValue[],
  traversal: CursorTraversal,
): string =>
  Buffer.from(
    JSON.stringify({
      direction: sort.direction,
      field: sort.field,
      traversal,
      v: CURSOR_VERSION,
      values,
    } satisfies CursorPayload),
    'utf8',
  ).toString('base64url');

export const decodeCursor = (
  cursor: string,
  sort: JournalTableSort,
  keyCount: number,
): Pick<CursorPayload, 'traversal' | 'values'> => {
  const invalid = (): never => {
    throw new AppError({
      code: 'validation-invalid',
      issues: [{ code: 'invalid-cursor', path: 'cursor' }],
      message: 'The journal page cursor is invalid.',
    });
  };
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return invalid();
  }
  if (typeof payload !== 'object' || payload === null) return invalid();
  const candidate = payload as Partial<CursorPayload>;
  if (candidate.v !== CURSOR_VERSION) return invalid();
  if (candidate.field !== sort.field || candidate.direction !== sort.direction) return invalid();
  if (candidate.traversal !== 'after' && candidate.traversal !== 'before') return invalid();
  if (!Array.isArray(candidate.values) || candidate.values.length !== keyCount) return invalid();
  if (
    !candidate.values.every(
      (value) => value === null || typeof value === 'string' || typeof value === 'number',
    )
  ) {
    return invalid();
  }
  return { traversal: candidate.traversal, values: candidate.values };
};
