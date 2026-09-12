import { existsSync, readFileSync, writeFileSync } from 'node:fs';

interface PreferencesDocument {
  readonly languageMode?: 'en' | 'ru' | 'system';
  readonly lastVaultPath?: string;
  readonly themeMode?: 'auto' | 'dark' | 'light';
}

export interface ApplicationSettings {
  readonly languageMode: 'en' | 'ru' | 'system';
  readonly themeMode: 'auto' | 'dark' | 'light';
}

const DEFAULT_SETTINGS: ApplicationSettings = { languageMode: 'system', themeMode: 'auto' };

export class RecentVaultPreferences {
  public constructor(private readonly preferencesFilePath: string) {}

  public getLastVaultPath(): string | null {
    const document = this.read();
    return typeof document.lastVaultPath === 'string' ? document.lastVaultPath : null;
  }

  public getSettings(): ApplicationSettings {
    const document = this.read();
    return {
      languageMode: document.languageMode ?? DEFAULT_SETTINGS.languageMode,
      themeMode: document.themeMode ?? DEFAULT_SETTINGS.themeMode,
    };
  }

  public setLastVaultPath(vaultPath: string): void {
    this.write({ ...this.read(), lastVaultPath: vaultPath });
  }

  public updateSettings(settings: ApplicationSettings): ApplicationSettings {
    this.write({ ...this.read(), ...settings });
    return settings;
  }

  private read(): PreferencesDocument {
    if (!existsSync(this.preferencesFilePath)) return {};
    try {
      return JSON.parse(readFileSync(this.preferencesFilePath, 'utf8')) as PreferencesDocument;
    } catch {
      return {};
    }
  }

  private write(document: PreferencesDocument): void {
    writeFileSync(this.preferencesFilePath, JSON.stringify(document), 'utf8');
  }
}
