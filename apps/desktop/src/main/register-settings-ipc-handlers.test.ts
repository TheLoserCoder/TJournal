import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ipcMainMock } = vi.hoisted(() => ({ ipcMainMock: { handle: vi.fn() } }));
vi.mock('electron', () => ({ ipcMain: ipcMainMock }));

import type { ApplicationSettingsDto, IpcResult } from '../shared/desktop-api';
import { DATA_RESOURCES } from '../shared/desktop-api';
import { DEFAULT_APPLICATION_SETTINGS } from '../shared/application-settings';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { registerSettingsIpcHandlers } from './register-settings-ipc-handlers';
import { createIpcTestHarness } from './testing/ipc-test-harness';

const createDependencies = () => ({
  recentVaultPreferences: {
    getSettings: vi.fn(() => DEFAULT_APPLICATION_SETTINGS),
    updateSettings: vi.fn((settings: ApplicationSettingsDto) => settings),
  },
});

describe('registerSettingsIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers exactly the documented settings channels', () => {
    const harness = createIpcTestHarness();
    registerSettingsIpcHandlers(createDependencies(), harness.context);

    expect([...harness.registeredChannels()].sort()).toEqual(
      [IPC_CHANNELS.settingsGet, IPC_CHANNELS.settingsUpdate].sort(),
    );
  });

  it('returns the stored settings without publishing changes', async () => {
    const harness = createIpcTestHarness();
    registerSettingsIpcHandlers(createDependencies(), harness.context);

    const result = await harness.invoke<IpcResult<ApplicationSettingsDto>>(
      IPC_CHANNELS.settingsGet,
    );

    expect(result).toEqual({ ok: true, value: DEFAULT_APPLICATION_SETTINGS });
    expect(harness.captureApplicationChange).not.toHaveBeenCalled();
  });

  it('validates and publishes an application-settings change', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerSettingsIpcHandlers(dependencies, harness.context);
    const updated: ApplicationSettingsDto = { ...DEFAULT_APPLICATION_SETTINGS, themeMode: 'dark' };

    const result = await harness.invoke<IpcResult<ApplicationSettingsDto>>(
      IPC_CHANNELS.settingsUpdate,
      updated,
    );

    expect(dependencies.recentVaultPreferences.updateSettings).toHaveBeenCalledWith(updated);
    expect(result).toEqual({ ok: true, value: updated });
    expect(harness.captureApplicationChange).toHaveBeenCalledWith([
      DATA_RESOURCES.applicationSettings,
    ]);
  });

  it('never updates preferences for an invalid payload', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerSettingsIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<ApplicationSettingsDto>>(
      IPC_CHANNELS.settingsUpdate,
      { themeMode: 'neon' },
    );

    expect(result.ok).toBe(false);
    expect(dependencies.recentVaultPreferences.updateSettings).not.toHaveBeenCalled();
    expect(harness.captureApplicationChange).not.toHaveBeenCalled();
  });
});
