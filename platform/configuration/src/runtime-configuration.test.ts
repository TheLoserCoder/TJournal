import { describe, expect, it } from 'vitest';

import { createRuntimeConfiguration } from './runtime-configuration';

describe('createRuntimeConfiguration', () => {
  it('uses a 30-day retention period by default', () => {
    expect(createRuntimeConfiguration()).toEqual({ logRetentionDays: 30 });
  });

  it('rejects invalid retention periods', () => {
    expect(() => createRuntimeConfiguration({ logRetentionDays: 0 })).toThrow();
  });
});
