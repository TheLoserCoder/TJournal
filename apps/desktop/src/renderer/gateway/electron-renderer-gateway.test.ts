import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopApi } from '../../shared/desktop-api';
import { createElectronRendererGateway } from './electron-renderer-gateway';

const setPreloadApi = (api: Partial<DesktopApi>): void => {
  (window as unknown as { tjournal: Partial<DesktopApi> }).tjournal = api;
};

afterEach(() => {
  (window as unknown as { tjournal?: Partial<DesktopApi> }).tjournal = undefined;
});

describe('createElectronRendererGateway', () => {
  it('forwards required preload calls without synthesising results', async () => {
    const getStatus = vi.fn().mockResolvedValue({
      ok: true as const,
      value: { appName: 'TJournal', appVersion: '1.0.0', logsDirectory: '/logs', vaultPath: '/v' },
    });
    const unsubscribe = vi.fn();
    const subscribe = vi.fn().mockReturnValue(unsubscribe);
    const listTags = vi.fn().mockResolvedValue({ ok: true as const, value: [] });
    const counts = vi.fn().mockResolvedValue({ ok: true as const, value: { tag: 2 } });
    setPreloadApi({
      changes: { subscribe } as unknown as DesktopApi['changes'],
      diagnostics: { getStatus } as unknown as DesktopApi['diagnostics'],
      tags: { counts, list: listTags } as unknown as DesktopApi['tags'],
    });
    const gateway = createElectronRendererGateway();

    await expect(gateway.getDiagnostics()).resolves.toMatchObject({ ok: true });
    expect(getStatus).toHaveBeenCalledTimes(1);

    const listener = vi.fn();
    const stop = gateway.subscribeToChanges(listener);
    expect(subscribe).toHaveBeenCalledWith(listener);
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    await expect(gateway.listTags()).resolves.toEqual({ ok: true, value: [] });
    await expect(gateway.getTagTradeCounts()).resolves.toEqual({ ok: true, value: { tag: 2 } });
    expect(listTags).toHaveBeenCalledTimes(1);
    expect(counts).toHaveBeenCalledTimes(1);
  });

  it('fails loudly instead of reporting an empty success for a missing method', () => {
    setPreloadApi({ tags: undefined as unknown as DesktopApi['tags'] });
    const gateway = createElectronRendererGateway();

    expect(() => gateway.listTags()).toThrow();
  });
});
