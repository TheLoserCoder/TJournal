import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Memory benchmarks read `global.gc` when it is present; exposing it does
    // not change behaviour for tests that never call it.
    execArgv: ['--expose-gc'],
    include: ['apps/**/*.test.{ts,tsx}', 'modules/**/*.test.{ts,tsx}', 'platform/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
  },
});
