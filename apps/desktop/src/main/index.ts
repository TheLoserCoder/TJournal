import { app, BrowserWindow, Menu } from 'electron';
import { join } from 'node:path';
import { toSafeAppError } from '@tjournal/platform-errors';

import { createDesktopContainer } from './desktop-container';
import type { DesktopDependencies } from './desktop-container';
import { getE2EEnvironmentValue } from './e2e-environment';
import { registerIpcHandlers } from './register-ipc-handlers';
import { createWindowOptions } from './window-options';
import { removeApplicationMenuUnlessMac } from './application-menu';

const applyE2EEnvironment = (): void => {
  const userDataDirectory = getE2EEnvironmentValue('TJOURNAL_E2E_USER_DATA_DIR');
  if (userDataDirectory !== null) app.setPath('userData', userDataDirectory);
};

applyE2EEnvironment();

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

let desktopDependencies: DesktopDependencies | null = null;

app.whenReady().then(async () => {
  // The renderer owns its navigation and shortcuts, so the default Electron menu
  // bar is removed on Windows and Linux (macOS keeps its system application menu).
  removeApplicationMenuUnlessMac(process.platform, Menu);

  const container = createDesktopContainer(app);
  const dependencies = container.cradle;
  desktopDependencies = dependencies;
  const lastVaultPath = dependencies.recentVaultPreferences.getLastVaultPath();

  registerIpcHandlers(dependencies, app.getName(), app.getVersion());

  if (lastVaultPath !== null) {
    try {
      await dependencies.openVaultUseCase.execute(lastVaultPath);
      dependencies.checkVaultIntegrityUseCase.execute();
      dependencies.committedChangeCoordinator.resetForVault();
      dependencies.logger.info('vault.restored');
    } catch (error) {
      dependencies.logger.warn('vault.restore-failed', { code: toSafeAppError(error).code });
    }
  }

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

app.on('before-quit', () => {
  void desktopDependencies?.analyticsWorkerClient.close();
  desktopDependencies?.journalStorage.close();
});
