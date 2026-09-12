import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['apps/**/*.test.{ts,tsx}', 'modules/**/*.test.{ts,tsx}', 'platform/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
  },
});
