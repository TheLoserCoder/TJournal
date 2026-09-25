import { afterEach, describe, expect, it, vi } from 'vitest';

import { getE2EEnvironmentValue, isE2EEnvironment } from './e2e-environment';

describe('E2E environment guards', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ignores the test seams outside the explicit E2E flag', () => {
    vi.stubEnv('TJOURNAL_E2E', '');
    vi.stubEnv('TJOURNAL_E2E_PICKER_FILE', 'C:/picker-queue.json');

    expect(isE2EEnvironment()).toBe(false);
    expect(getE2EEnvironmentValue('TJOURNAL_E2E_PICKER_FILE')).toBeNull();
  });

  it('reads seam values only when the E2E flag is set', () => {
    vi.stubEnv('TJOURNAL_E2E', '1');
    vi.stubEnv('TJOURNAL_E2E_PICKER_FILE', 'C:/picker-queue.json');

    expect(isE2EEnvironment()).toBe(true);
    expect(getE2EEnvironmentValue('TJOURNAL_E2E_PICKER_FILE')).toBe('C:/picker-queue.json');
    expect(getE2EEnvironmentValue('TJOURNAL_E2E_MISSING')).toBeNull();
  });
});
