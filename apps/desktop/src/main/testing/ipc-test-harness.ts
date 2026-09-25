import { vi, type Mock } from 'vitest';
import { ipcMain } from 'electron';

import type { IpcRegistrationContext } from '../ipc-registration-context';

export interface IpcTestHarness {
  readonly capture: Mock;
  readonly captureApplicationChange: Mock;
  readonly context: IpcRegistrationContext;
  readonly logger: { debug: Mock; error: Mock; info: Mock; warn: Mock };
  readonly publish: Mock;
  /** Invokes the handler registered for a channel, as Electron would. */
  invoke<T = unknown>(channel: string, ...args: readonly unknown[]): Promise<T>;
  registeredChannels(): readonly string[];
}

/**
 * Test double for the Electron `ipcMain` transport. The test file must mock the
 * `electron` module with `ipcMain.handle` as a `vi.fn()`.
 */
export const createIpcTestHarness = (): IpcTestHarness => {
  const handle = ipcMain.handle as unknown as Mock;
  const capture = vi.fn();
  const captureApplicationChange = vi.fn();
  const publish = vi.fn();
  const logger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
  return {
    capture,
    captureApplicationChange,
    context: { capture, captureApplicationChange, logger, publish },
    logger,
    publish,
    invoke: async <T>(channel: string, ...args: readonly unknown[]): Promise<T> => {
      const call = handle.mock.calls.find(([registeredChannel]) => registeredChannel === channel);
      if (call === undefined) throw new Error(`IPC channel ${channel} is not registered.`);
      return call[1](null, ...args) as Promise<T>;
    },
    registeredChannels: () => handle.mock.calls.map(([channel]) => channel as string),
  };
};
