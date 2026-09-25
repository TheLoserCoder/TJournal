import { ipcMain } from 'electron';

import { DATA_RESOURCES } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { UndoRedoHistory } from './history/undo-redo-history';
import { asResult } from './ipc-result';
import type { IpcRegistrationContext } from './ipc-registration-context';

export interface HistoryIpcDependencies {
  readonly history: Pick<UndoRedoHistory, 'getState' | 'redo' | 'undo'>;
}

export const registerHistoryIpcHandlers = (
  dependencies: HistoryIpcDependencies,
  context: IpcRegistrationContext,
): void => {
  ipcMain.handle(IPC_CHANNELS.historyGetState, () =>
    asResult(() => dependencies.history.getState(), context.logger, 'ipc.history-get.failed'),
  );

  ipcMain.handle(IPC_CHANNELS.historyUndo, () =>
    asResult(
      () => {
        const changed = dependencies.history.undo();
        if (changed) context.capture([DATA_RESOURCES.history]);
        return dependencies.history.getState();
      },
      context.logger,
      'ipc.history-undo.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.historyRedo, () =>
    asResult(
      () => {
        const changed = dependencies.history.redo();
        if (changed) context.capture([DATA_RESOURCES.history]);
        return dependencies.history.getState();
      },
      context.logger,
      'ipc.history-redo.failed',
    ),
  );
};
