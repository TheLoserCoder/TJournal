import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopApi } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';

const desktopApi: DesktopApi = {
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
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, input),
  },
  trades: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.tradesCreate, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.tradesDelete, id),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.tradesList),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.tradesUpdate, input),
  },
  vault: {
    create: () => ipcRenderer.invoke(IPC_CHANNELS.vaultCreate),
    open: () => ipcRenderer.invoke(IPC_CHANNELS.vaultOpen),
  },
};

contextBridge.exposeInMainWorld('tjournal', desktopApi);
