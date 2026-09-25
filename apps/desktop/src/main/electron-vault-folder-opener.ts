import { shell } from 'electron';

import type { VaultFolderOpener } from '@tjournal/journal';
import { AppError } from '@tjournal/platform-errors';

export class ElectronVaultFolderOpener implements VaultFolderOpener {
  public async revealDirectory(directoryPath: string): Promise<void> {
    const failure = await shell.openPath(directoryPath);
    if (failure !== '') {
      throw new AppError({
        code: 'vault-not-accessible',
        message: failure,
      });
    }
  }
}
