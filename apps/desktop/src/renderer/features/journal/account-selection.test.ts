import { describe, expect, it } from 'vitest';

import { resolveAccountSelection, type AccountSelectionOption } from './account-selection';

const accounts: readonly AccountSelectionOption[] = [
  { archivedAt: null, id: 'account-a' },
  { archivedAt: null, id: 'account-b' },
  { archivedAt: '2026-09-17T00:00:00.000Z', id: 'account-archived' },
];

describe('resolveAccountSelection', () => {
  it('keeps the current user selection over the remembered value', () => {
    expect(resolveAccountSelection(accounts, 'account-b', 'account-a')).toBe('account-b');
  });

  it('restores a remembered active account when there is no current selection', () => {
    expect(resolveAccountSelection(accounts, null, 'account-b')).toBe('account-b');
  });

  it('falls back to the first active account when both selections are unavailable', () => {
    expect(resolveAccountSelection(accounts, 'account-archived', 'missing')).toBe('account-a');
  });

  it('returns null when no active accounts exist', () => {
    expect(
      resolveAccountSelection([{ archivedAt: '2026-09-17', id: 'account-a' }], null, null),
    ).toBe(null);
  });

  it('keeps identity stable when account ordering changes', () => {
    expect(
      resolveAccountSelection(
        [
          { archivedAt: null, id: 'account-b' },
          { archivedAt: null, id: 'account-a' },
          { archivedAt: '2026-09-17T00:00:00.000Z', id: 'account-archived' },
        ],
        'account-b',
        'account-a',
      ),
    ).toBe('account-b');
  });
});
