import { describe, expect, it, vi } from 'vitest';

import { removeApplicationMenuUnlessMac } from './application-menu';

describe('application menu', () => {
  it('removes the native menu bar on Windows and Linux', () => {
    for (const platform of ['win32', 'linux'] as const) {
      const menu = { setApplicationMenu: vi.fn() };
      removeApplicationMenuUnlessMac(platform, menu);
      expect(menu.setApplicationMenu).toHaveBeenCalledWith(null);
    }
  });

  it('keeps the standard application menu on macOS', () => {
    const menu = { setApplicationMenu: vi.fn() };
    removeApplicationMenuUnlessMac('darwin', menu);
    expect(menu.setApplicationMenu).not.toHaveBeenCalled();
  });
});
