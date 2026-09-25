import { describe, expect, it } from 'vitest';

import { createWindowOptions } from './window-options';

describe('createWindowOptions', () => {
  it('isolates the renderer from Node.js and the main process', () => {
    const preloadPath = 'test-preload.js';
    const options = createWindowOptions(preloadPath);

    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: true,
    });
  });

  it('keeps the documented desktop minimum window width', () => {
    const options = createWindowOptions('test-preload.js');

    expect(options.minWidth).toBe(960);
    expect(options.minHeight).toBe(640);
  });
});
