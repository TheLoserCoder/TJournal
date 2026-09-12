import { contextBridge, ipcRenderer } from 'electron';

interface AppInfo {
  readonly name: string;
  readonly platform: string;
  readonly version: string;
}

const desktopApi = {
  app: {
    getInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:get-info'),
  },
};

contextBridge.exposeInMainWorld('tjournal', desktopApi);
