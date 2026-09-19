declare module 'electron' {
  export interface BrowserWindowConstructorOptions {
    readonly height?: number;
    readonly minHeight?: number;
    readonly minWidth?: number;
    readonly preload?: string;
    readonly webPreferences?: {
      readonly contextIsolation?: boolean;
      readonly nodeIntegration?: boolean;
      readonly preload?: string;
      readonly sandbox?: boolean;
    };
    readonly width?: number;
  }

  export class BrowserWindow {
    public constructor(options: BrowserWindowConstructorOptions);
    public static getAllWindows(): BrowserWindow[];
    public isDestroyed(): boolean;
    public loadFile(path: string): Promise<void>;
    public loadURL(url: string): Promise<void>;
    public readonly webContents: { send(channel: string, value: unknown): void };
  }

  export interface App {
    getName(): string;
    getPath(name: string): string;
    getVersion(): string;
    on(event: string, listener: () => void): this;
    quit(): void;
    whenReady(): Promise<void>;
  }
  export const app: App;

  export const contextBridge: { exposeInMainWorld(name: string, value: unknown): void };
  export const dialog: {
    showOpenDialog(options: {
      properties: readonly string[];
    }): Promise<{ canceled: boolean; filePaths: string[] }>;
  };
  export const ipcMain: {
    handle(channel: string, listener: (...args: never[]) => unknown): void;
  };
  export const ipcRenderer: {
    invoke<T>(channel: string, ...args: readonly unknown[]): Promise<T>;
    on(
      channel: string,
      listener: (event: Electron.IpcRendererEvent, ...args: readonly unknown[]) => void,
    ): void;
    removeListener(
      channel: string,
      listener: (event: Electron.IpcRendererEvent, ...args: readonly unknown[]) => void,
    ): void;
  };
}

declare namespace Electron {
  interface IpcRendererEvent {
    readonly sender: unknown;
  }
}
