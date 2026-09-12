import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('shows vault onboarding when no vault is active', async () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      })),
    });
    Object.defineProperty(window, 'tjournal', {
      value: {
        diagnostics: {
          getStatus: vi.fn().mockResolvedValue({ ok: true, value: { vaultPath: null } }),
        },
        trades: { create: vi.fn(), list: vi.fn() },
        vault: { create: vi.fn(), open: vi.fn() },
      },
    });
    render(<App />);
    expect(
      await screen.findByRole('button', { name: /create vault|создать vault/i }),
    ).toBeInTheDocument();
  });
});
