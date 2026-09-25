/**
 * Explicit Electron E2E switches. Every helper returns a safe default unless
 * the dedicated TJOURNAL_E2E flag is present, so production builds ignore the
 * test seams even if an unrelated environment variable is set.
 */
const E2E_FLAG = 'TJOURNAL_E2E';

export const isE2EEnvironment = (): boolean => process.env[E2E_FLAG] === '1';

export const getE2EEnvironmentValue = (name: string): string | null => {
  if (!isE2EEnvironment()) return null;
  const value = process.env[name];
  return value === undefined || value === '' ? null : value;
};
