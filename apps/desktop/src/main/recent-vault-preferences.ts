import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import {
  applicationSettingsSchema,
  DEFAULT_APPLICATION_SETTINGS,
} from '../shared/application-settings';
import type { ApplicationSettingsDto } from '../shared/desktop-api';

interface PreferencesDocument {
  readonly languageMode?: ApplicationSettingsDto['languageMode'];
  readonly lastVaultPath?: string;
  readonly tableLayouts?: ApplicationSettingsDto['tableLayouts'];
  readonly themeMode?: ApplicationSettingsDto['themeMode'];
  readonly tradeSummary?: ApplicationSettingsDto['tradeSummary'];
}

export type ApplicationSettings = ApplicationSettingsDto;

export class RecentVaultPreferences {
  public constructor(private readonly preferencesFilePath: string) {}

  public getLastVaultPath(): string | null {
    const document = this.read();
    return typeof document.lastVaultPath === 'string' ? document.lastVaultPath : null;
  }

  public getSettings(): ApplicationSettings {
    const document = this.read();
    const parsed = applicationSettingsSchema.safeParse({
      languageMode: document.languageMode ?? DEFAULT_APPLICATION_SETTINGS.languageMode,
      tableLayouts: document.tableLayouts ?? DEFAULT_APPLICATION_SETTINGS.tableLayouts,
      themeMode: document.themeMode ?? DEFAULT_APPLICATION_SETTINGS.themeMode,
      tradeSummary: {
        ...DEFAULT_APPLICATION_SETTINGS.tradeSummary,
        ...document.tradeSummary,
      },
    });
    return parsed.success ? parsed.data : DEFAULT_APPLICATION_SETTINGS;
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
