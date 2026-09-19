import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopApi } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { isCommittedDataChange } from './data-change-schema';

const desktopApi: DesktopApi = {
  changes: {
    subscribe: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, value: unknown): void => {
        if (isCommittedDataChange(value)) listener(value);
      };
      ipcRenderer.on(IPC_CHANNELS.dataChanged, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.dataChanged, handler);
    },
  },
  analytics: {
    summary: (input) => ipcRenderer.invoke(IPC_CHANNELS.analyticsSummary, input),
  },
  diagnostics: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.diagnosticsGetStatus),
  },
  history: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.historyGetState),
    redo: () => ipcRenderer.invoke(IPC_CHANNELS.historyRedo),
    undo: () => ipcRenderer.invoke(IPC_CHANNELS.historyUndo),
  },
  instruments: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.instrumentsCreate, input),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.instrumentsList),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.instrumentsUpdate, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.instrumentsDelete, id),
    restore: (id) => ipcRenderer.invoke(IPC_CHANNELS.instrumentsRestore, id),
  },
  accounts: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.accountsCreate, input),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.accountsList),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.accountsUpdate, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.accountsDelete, id),
    restore: (id) => ipcRenderer.invoke(IPC_CHANNELS.accountsRestore, id),
    defaults: (id) => ipcRenderer.invoke(IPC_CHANNELS.accountsDefaults, id),
  },
  cashMovements: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.cashMovementsCreate, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.cashMovementsDelete, id),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.cashMovementsList),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.cashMovementsUpdate, input),
  },
  instrumentProfiles: {
    get: (instrumentId) => ipcRenderer.invoke(IPC_CHANNELS.instrumentProfilesGet, instrumentId),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.instrumentProfilesUpdate, input),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, input),
  },
  trades: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.tradesCreate, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.tradesDelete, id),
    deleteMany: (ids) => ipcRenderer.invoke(IPC_CHANNELS.tradesDeleteMany, ids),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.tradesList),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.tradesUpdate, input),
  },
  tradePreferences: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.tradePreferencesGet),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.tradePreferencesUpdate, input),
  },
  vault: {
    create: () => ipcRenderer.invoke(IPC_CHANNELS.vaultCreate),
    open: () => ipcRenderer.invoke(IPC_CHANNELS.vaultOpen),
  },
};

contextBridge.exposeInMainWorld('tjournal', desktopApi);
