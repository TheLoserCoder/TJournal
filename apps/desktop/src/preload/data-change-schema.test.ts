import { describe, expect, it } from 'vitest';

import { isCommittedDataChange } from './data-change-schema';

const validChange = {
  changeId: 'change-1',
  resources: ['trades', 'trade-preferences'],
  revisions: { trades: 3, 'trade-preferences': 1 },
  vaultGeneration: 'vault-1',
};

describe('isCommittedDataChange', () => {
  it('accepts a typed data invalidation event without a preload dependency', () => {
    expect(isCommittedDataChange(validChange)).toBe(true);
  });

  it('rejects malformed revisions and unknown data resources', () => {
    expect(
      isCommittedDataChange({
        ...validChange,
        resources: ['unknown-resource'],
      }),
    ).toBe(false);
    expect(
      isCommittedDataChange({
        ...validChange,
        revisions: { trades: -1 },
      }),
    ).toBe(false);
  });
});
