import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ipcMainMock } = vi.hoisted(() => ({ ipcMainMock: { handle: vi.fn() } }));
vi.mock('electron', () => ({ ipcMain: ipcMainMock }));

import type { IpcResult, TradeSummaryDto } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { registerAnalyticsIpcHandlers } from './register-analytics-ipc-handlers';
import { createIpcTestHarness } from './testing/ipc-test-harness';

const SUMMARY: TradeSummaryDto = {
  bestInstrument: null,
  coveredTrades: 0,
  losingTrades: 0,
  neutralTrades: 0,
  totalResult: '0',
  totalTrades: 0,
  winRate: null,
  winningTrades: 0,
  worstInstrument: null,
};

const createDependencies = (vaultGeneration = 'generation-1') => ({
  analyticsWorkerClient: {
    runReport: vi.fn(),
    runSummary: vi.fn(async () => ({
      durationMs: 1,
      kind: 'summary' as const,
      requestId: 'request-1',
      revisions: {},
      summary: SUMMARY,
      vaultGeneration,
    })),
  },
  committedChangeCoordinator: {
    getVaultGeneration: vi.fn(() => 'generation-1'),
    isCurrent: vi.fn(() => true),
  },
});

const QUERY = { filters: null, metric: 'cash' as const, period: 'all' as const };

describe('registerAnalyticsIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers exactly the documented analytics channels', () => {
    const harness = createIpcTestHarness();
    registerAnalyticsIpcHandlers(createDependencies(), harness.context);

    expect([...harness.registeredChannels()].sort()).toEqual(
      [IPC_CHANNELS.analyticsReport, IPC_CHANNELS.analyticsSummary].sort(),
    );
  });

  it('runs the summary with the current vault generation', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerAnalyticsIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<TradeSummaryDto | null>>(
      IPC_CHANNELS.analyticsSummary,
      QUERY,
    );

    expect(dependencies.analyticsWorkerClient.runSummary).toHaveBeenCalledWith(
      QUERY,
      'generation-1',
    );
    expect(result).toEqual({ ok: true, value: SUMMARY });
  });

  it('drops a summary computed for a stale vault generation', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies('generation-0');
    registerAnalyticsIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<TradeSummaryDto | null>>(
      IPC_CHANNELS.analyticsSummary,
      QUERY,
    );

    expect(result).toEqual({ ok: true, value: null });
  });

  it('never runs the worker for an invalid payload', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerAnalyticsIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<TradeSummaryDto | null>>(
      IPC_CHANNELS.analyticsSummary,
      { filters: null, metric: 'unknown', period: 'all' },
    );

    expect(result.ok).toBe(false);
    expect(dependencies.analyticsWorkerClient.runSummary).not.toHaveBeenCalled();
  });
});
