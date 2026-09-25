import { readFileSync, writeFileSync } from 'node:fs';

import type { VaultLocationPicker } from '@tjournal/journal';

/**
 * Test-only picker: consumes folder paths from a JSON queue file so Electron
 * E2E runs never open the native directory dialog. It is wired only when the
 * explicit TJOURNAL_E2E environment is present.
 */
export class E2EVaultLocationPicker implements VaultLocationPicker {
  public constructor(private readonly queueFilePath: string) {}

  public async pickDirectory(): Promise<string | null> {
    const queue = JSON.parse(readFileSync(this.queueFilePath, 'utf8')) as string[];
    const [next = null, ...rest] = queue;
    writeFileSync(this.queueFilePath, JSON.stringify(rest), 'utf8');
    return next;
  }
}
