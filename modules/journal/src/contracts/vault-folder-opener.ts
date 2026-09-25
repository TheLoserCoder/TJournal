export interface VaultFolderOpener {
  revealDirectory(directoryPath: string): Promise<void>;
}
