import { describe, expect, it } from 'vitest';

import type { RefreshTarget } from './refresh-resources';
import { RefreshScheduler } from './refresh-scheduler';

const flushTasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('RefreshScheduler', () => {
  it('coalesces same-turn schedules into one run without losing targets', async () => {
    const runs: (readonly RefreshTarget[])[] = [];
    const scheduler = new RefreshScheduler(async (targets) => {
      runs.push([...targets]);
    });

    scheduler.schedule(['tags']);
    scheduler.schedule(['accounts', 'tags']);
    scheduler.schedule(['history']);
    await flushTasks();

    expect(runs).toEqual([['tags', 'accounts', 'history']]);
  });

  it('merges targets scheduled while a run is still active', async () => {
    const runs: (readonly RefreshTarget[])[] = [];
    let releaseFirstRun: (() => void) | undefined;
    const firstRun = new Promise<void>((resolve) => {
      releaseFirstRun = resolve;
    });
    const scheduler = new RefreshScheduler(async (targets) => {
      runs.push([...targets]);
      if (runs.length === 1) await firstRun;
    });

    scheduler.schedule(['tags']);
    await flushTasks();
    expect(runs).toEqual([['tags']]);

    scheduler.schedule(['accounts']);
    releaseFirstRun?.();
    await flushTasks();

    expect(runs).toEqual([['tags'], ['accounts']]);
  });

  it('awaits a drained full refresh for vault activation', async () => {
    const runs: (readonly RefreshTarget[])[] = [];
    const scheduler = new RefreshScheduler(async (targets) => {
      runs.push([...targets]);
    });

    scheduler.schedule(['tags']);
    await flushTasks();
    await scheduler.refreshAll();

    expect(runs).toEqual([['tags'], ['all']]);
  });

  it('ignores schedules after disposal', async () => {
    const runs: (readonly RefreshTarget[])[] = [];
    const scheduler = new RefreshScheduler(async (targets) => {
      runs.push([...targets]);
    });

    scheduler.dispose();
    scheduler.schedule(['tags']);
    await flushTasks();

    expect(runs).toEqual([]);
  });
});
