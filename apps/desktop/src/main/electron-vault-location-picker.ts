import { dialog } from 'electron';

import type { VaultLocationPicker } from '@tjournal/journal';

export class ElectronVaultLocationPicker implements VaultLocationPicker {
  public async pickDirectory(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ['createDirectory', 'openDirectory'],
    });

    return result.canceled ? null : (result.filePaths[0] ?? null);
  }
}
