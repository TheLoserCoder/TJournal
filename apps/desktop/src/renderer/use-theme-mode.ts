import { useEffect, useState } from 'react';

import type { ThemeMode } from '../shared/desktop-api';

const THEME_STORAGE_KEY = 'tjournal.theme-mode';

const getSavedThemeMode = (): ThemeMode => {
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === 'dark' || value === 'light' ? value : 'auto';
};

export const useThemeMode = (): readonly [ThemeMode, (mode: ThemeMode) => void] => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getSavedThemeMode);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = (): void => {
      document.documentElement.dataset.theme =
        themeMode === 'auto' ? (mediaQuery.matches ? 'dark' : 'light') : themeMode;
    };
    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [themeMode]);

  const updateThemeMode = (mode: ThemeMode): void => {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    setThemeMode(mode);
  };

  return [themeMode, updateThemeMode];
};
