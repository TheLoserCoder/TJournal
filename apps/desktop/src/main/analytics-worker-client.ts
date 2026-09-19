import { randomUUID } from 'node:crypto';

import Piscina from 'piscina';

import type { SqliteVaultDatabase } from '@tjournal/platform-database';
import workerPath from './analytics-worker?modulePath';
import type { TradeSummaryJob, TradeSummaryJobResult } from './analytics-worker-contract';

const WORKER_COUNT = 1;
const MAX_QUEUE_SIZE = 1;
const IDLE_TIMEOUT_MS = 10_000;

export class AnalyticsWorkerClient {
  private readonly pool = new Piscina<TradeSummaryJob, TradeSummaryJobResult>({
    filename: workerPath,
    idleTimeout: IDLE_TIMEOUT_MS,
    maxQueue: MAX_QUEUE_SIZE,
    maxThreads: WORKER_COUNT,
    minThreads: WORKER_COUNT,
  });
  private activeController: AbortController | null = null;
  private pendingRequest: {
    readonly controller: AbortController;
    readonly job: TradeSummaryJob;
    readonly reject: (error: Error) => void;
    readonly resolve: (result: TradeSummaryJobResult) => void;
  } | null = null;

  public constructor(private readonly vaultDatabase: SqliteVaultDatabase) {}

  public run(
    query: TradeSummaryJob['query'],
    vaultGeneration: string,
  ): Promise<TradeSummaryJobResult> {
    const databasePath = this.vaultDatabase.getDatabasePath();
    if (databasePath === null) {
      throw new Error('Cannot calculate analytics without an open vault.');
    }
    const job: TradeSummaryJob = {
      databasePath,
      query,
      requestId: randomUUID(),
      vaultGeneration,
    };
    const request = new Promise<TradeSummaryJobResult>((resolve, reject) => {
      const controller = new AbortController();
      this.activeController?.abort();
      this.pendingRequest?.reject(this.createAbortError());
      this.pendingRequest = { controller, job, reject, resolve };
    });
    this.startPendingRequest();
    return request;
  }

  public async close(): Promise<void> {
    this.activeController?.abort();
    this.pendingRequest?.reject(this.createAbortError());
    this.pendingRequest = null;
    this.activeController = null;
    await this.pool.destroy();
  }

  private startPendingRequest(): void {
    if (this.activeController !== null || this.pendingRequest === null) return;
    const pending = this.pendingRequest;
    this.pendingRequest = null;
    this.activeController = pending.controller;
    void this.pool
      .run(pending.job, { signal: pending.controller.signal })
      .then(pending.resolve, pending.reject)
      .finally(() => {
        if (this.activeController !== pending.controller) return;
        this.activeController = null;
        this.startPendingRequest();
      });
  }

  private createAbortError(): Error {
    const error = new Error('Analytics request was superseded.');
    error.name = 'AbortError';
    return error;
  }
}
