import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';

import { createWindowOptions } from './window-options';

interface AppInfo {
  readonly name: string;
  readonly platform: NodeJS.Platform;
  readonly version: string;
}

const createMainWindow = (): BrowserWindow => {
  const preloadPath = join(__dirname, '../preload/index.js');
  const mainWindow = new BrowserWindow(createWindowOptions(preloadPath));

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;

  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl);
    return mainWindow;
  }

  void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  return mainWindow;
};

const getAppInfo = (): AppInfo => ({
  name: app.getName(),
  platform: process.platform,
  version: app.getVersion(),
});

const registerIpcHandlers = (): void => {
  ipcMain.handle('app:get-info', getAppInfo);
};

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
