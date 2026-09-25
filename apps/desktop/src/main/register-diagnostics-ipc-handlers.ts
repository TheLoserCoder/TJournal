import { ipcMain } from 'electron';

import type { JournalStorage } from '@tjournal/journal';
import type { ApplicationPaths } from '@tjournal/platform-configuration';

import { IPC_CHANNELS } from '../shared/ipc-channels';
import { asResult } from './ipc-result';
import type { IpcRegistrationContext } from './ipc-registration-context';

export interface DiagnosticsIpcDependencies {
  readonly appName: string;
  readonly appVersion: string;
  readonly applicationPaths: Pick<ApplicationPaths, 'logsDirectory'>;
  readonly journalStorage: Pick<JournalStorage, 'getStatus'>;
}

export const registerDiagnosticsIpcHandlers = (
  dependencies: DiagnosticsIpcDependencies,
  context: IpcRegistrationContext,
): void => {
  ipcMain.handle(IPC_CHANNELS.diagnosticsGetStatus, () =>
    asResult(
      () => ({
        appName: dependencies.appName,
        appVersion: dependencies.appVersion,
        logsDirectory: dependencies.applicationPaths.logsDirectory,
        vaultPath: dependencies.journalStorage.getStatus().path,
      }),
      context.logger,
      'ipc.diagnostics.failed',
    ),
  );
};
