import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('shows the trades shell through the renderer gateway', async () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      })),
    });
    Object.defineProperty(window, 'tjournal', {
      value: {
        diagnostics: { getStatus: vi.fn() },
        history: {
          getState: vi.fn().mockResolvedValue({
            ok: true,
            value: { canRedo: false, canUndo: false, redoLabel: null, undoLabel: null },
          }),
          redo: vi.fn(),
          undo: vi.fn(),
        },
        instruments: { create: vi.fn(), list: vi.fn().mockResolvedValue({ ok: true, value: [] }) },
        settings: {
          get: vi
            .fn()
            .mockResolvedValue({ ok: true, value: { languageMode: 'system', themeMode: 'auto' } }),
          update: vi.fn(),
        },
        trades: {
          create: vi.fn(),
          delete: vi.fn(),
          list: vi.fn().mockResolvedValue({ ok: true, value: [] }),
          update: vi.fn(),
        },
        vault: { create: vi.fn(), open: vi.fn() },
      },
    });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Сделки' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Настройки' })).toBeInTheDocument();
  });
});
