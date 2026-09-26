import type { BrowserWindowConstructorOptions } from 'electron';

const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 800;
const MINIMUM_WINDOW_WIDTH = 960;
const MINIMUM_WINDOW_HEIGHT = 640;

export const createWindowOptions = (
  preloadPath: string,
  iconPath: string,
): BrowserWindowConstructorOptions => ({
  width: DEFAULT_WINDOW_WIDTH,
  height: DEFAULT_WINDOW_HEIGHT,
  minWidth: MINIMUM_WINDOW_WIDTH,
  minHeight: MINIMUM_WINDOW_HEIGHT,
  icon: iconPath,
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    preload: preloadPath,
    sandbox: true,
  },
});
