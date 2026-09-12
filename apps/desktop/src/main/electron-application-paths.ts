import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type { App } from 'electron';

import type { ApplicationPaths } from '@tjournal/platform-configuration';

const RUNTIME_DIRECTORY_NAME = 'tjournal-runtime';
const LOGS_DIRECTORY_NAME = 'logs';
const PREFERENCES_FILE_NAME = 'preferences.json';

export const createElectronApplicationPaths = (electronApp: App): ApplicationPaths => {
  const applicationDataDirectory = join(electronApp.getPath('userData'), RUNTIME_DIRECTORY_NAME);
  const logsDirectory = join(applicationDataDirectory, LOGS_DIRECTORY_NAME);
  mkdirSync(logsDirectory, { recursive: true });

  return {
    applicationDataDirectory,
    logsDirectory,
    preferencesFilePath: join(applicationDataDirectory, PREFERENCES_FILE_NAME),
  };
};
