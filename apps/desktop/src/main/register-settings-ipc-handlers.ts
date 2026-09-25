import { ipcMain } from 'electron';

import { applicationSettingsSchema } from '../shared/application-settings';
import { DATA_RESOURCES } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { asResult } from './ipc-result';
import type { IpcRegistrationContext } from './ipc-registration-context';
import { parseIpcInput } from './parse-ipc-input';
import type { RecentVaultPreferences } from './recent-vault-preferences';

export interface SettingsIpcDependencies {
  readonly recentVaultPreferences: Pick<RecentVaultPreferences, 'getSettings' | 'updateSettings'>;
}

export const registerSettingsIpcHandlers = (
  dependencies: SettingsIpcDependencies,
  context: IpcRegistrationContext,
): void => {
  ipcMain.handle(IPC_CHANNELS.settingsGet, () =>
    asResult(
      () => dependencies.recentVaultPreferences.getSettings(),
      context.logger,
      'ipc.settings-get.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.settingsUpdate, (_event, settings: unknown) =>
    asResult(
      () => {
        const result = dependencies.recentVaultPreferences.updateSettings(
          parseIpcInput(applicationSettingsSchema, settings),
        );
        context.captureApplicationChange([DATA_RESOURCES.applicationSettings]);
        return result;
      },
      context.logger,
      'ipc.settings-update.failed',
    ),
  );
};
