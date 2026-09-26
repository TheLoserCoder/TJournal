import { describe, expect, it } from 'vitest';

import { createWindowOptions } from './window-options';

describe('createWindowOptions', () => {
  it('isolates the renderer from Node.js and the main process', () => {
    const preloadPath = 'test-preload.js';
    const options = createWindowOptions(preloadPath, 'test-icon.png');

    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: true,
    });
  });

  it('keeps the documented desktop minimum window width', () => {
    const options = createWindowOptions('test-preload.js', 'test-icon.png');

    expect(options.minWidth).toBe(960);
    expect(options.minHeight).toBe(640);
  });

  it('uses the resolved application icon for the window', () => {
    const options = createWindowOptions('test-preload.js', 'test-icon.png');

    expect(options.icon).toBe('test-icon.png');
  });
});
