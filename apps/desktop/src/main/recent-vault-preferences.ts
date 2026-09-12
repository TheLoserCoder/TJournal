import { existsSync, readFileSync, writeFileSync } from 'node:fs';

interface PreferencesDocument {
  readonly lastVaultPath?: string;
}

export class RecentVaultPreferences {
  public constructor(private readonly preferencesFilePath: string) {}

  public getLastVaultPath(): string | null {
    if (!existsSync(this.preferencesFilePath)) {
      return null;
    }

    try {
      const document = JSON.parse(
        readFileSync(this.preferencesFilePath, 'utf8'),
      ) as PreferencesDocument;
      return typeof document.lastVaultPath === 'string' ? document.lastVaultPath : null;
    } catch {
      return null;
    }
  }

  public setLastVaultPath(vaultPath: string): void {
    writeFileSync(this.preferencesFilePath, JSON.stringify({ lastVaultPath: vaultPath }), 'utf8');
  }
}
