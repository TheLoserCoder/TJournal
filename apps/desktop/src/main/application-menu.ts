/** The subset of Electron's Menu used to remove the native menu bar. */
export interface ApplicationMenuHost {
  setApplicationMenu(menu: null): void;
}

/**
 * The default File/Edit/View/Window bar is a Windows and Linux artifact that
 * duplicates the app's own chrome. macOS keeps its standard application menu,
 * which lives in the system menu bar and carries the platform shortcuts.
 */
export const removeApplicationMenuUnlessMac = (
  platform: NodeJS.Platform,
  menu: ApplicationMenuHost,
): void => {
  if (platform !== 'darwin') menu.setApplicationMenu(null);
};
