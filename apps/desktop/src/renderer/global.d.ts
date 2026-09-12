interface AppInfo {
  readonly name: string;
  readonly platform: string;
  readonly version: string;
}

declare module '*.css';

interface Window {
  readonly tjournal: {
    readonly app: {
      getInfo(): Promise<AppInfo>;
    };
  };
}
