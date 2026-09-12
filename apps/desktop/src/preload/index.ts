import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopApi } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';

const desktopApi: DesktopApi = {
  diagnostics: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.diagnosticsGetStatus),
  },
  trades: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.tradesCreate, input),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.tradesList),
  },
  vault: {
    create: () => ipcRenderer.invoke(IPC_CHANNELS.vaultCreate),
    open: () => ipcRenderer.invoke(IPC_CHANNELS.vaultOpen),
  },
};

contextBridge.exposeInMainWorld('tjournal', desktopApi);
