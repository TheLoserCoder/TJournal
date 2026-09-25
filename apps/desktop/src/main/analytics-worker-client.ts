import { randomUUID } from 'node:crypto';

import Piscina from 'piscina';

import type { SqliteVaultDatabase } from '@tjournal/platform-database';
import workerPath from './analytics-worker?modulePath';
import type {
  AnalyticsJob,
  AnalyticsJobResult,
  AnalyticsReportJob,
  AnalyticsReportJobResult,
  TradeSummaryJob,
  TradeSummaryJobResult,
} from './analytics-worker-contract';

const WORKER_COUNT = 1;
const MAX_QUEUE_SIZE = 1;
const IDLE_TIMEOUT_MS = 10_000;

type AnalyticsJobInput =
  | Readonly<{ kind: 'report'; query: AnalyticsReportJob['query'] }>
  | Readonly<{ kind: 'summary'; query: TradeSummaryJob['query'] }>;

export class AnalyticsWorkerClient {
  private readonly pool = new Piscina<AnalyticsJob, AnalyticsJobResult>({
    filename: workerPath,
    idleTimeout: IDLE_TIMEOUT_MS,
    maxQueue: MAX_QUEUE_SIZE,
    maxThreads: WORKER_COUNT,
    minThreads: WORKER_COUNT,
  });
  private activeController: AbortController | null = null;
  private pendingRequest: {
    readonly controller: AbortController;
    readonly job: AnalyticsJob;
    readonly reject: (error: Error) => void;
    readonly resolve: (result: AnalyticsJobResult) => void;
  } | null = null;

  public constructor(private readonly vaultDatabase: SqliteVaultDatabase) {}

  public async runSummary(
    query: TradeSummaryJob['query'],
    vaultGeneration: string,
  ): Promise<TradeSummaryJobResult> {
    const result = await this.run({ kind: 'summary', query }, vaultGeneration);
    if (result.kind !== 'summary') throw new Error('Analytics worker returned an invalid result.');
    return result;
  }

  public async runReport(
    query: AnalyticsReportJob['query'],
    vaultGeneration: string,
  ): Promise<AnalyticsReportJobResult> {
    const result = await this.run({ kind: 'report', query }, vaultGeneration);
    if (result.kind !== 'report') throw new Error('Analytics worker returned an invalid result.');
    return result;
  }

  private run(input: AnalyticsJobInput, vaultGeneration: string): Promise<AnalyticsJobResult> {
    const databasePath = this.vaultDatabase.getDatabasePath();
    if (databasePath === null) {
      throw new Error('Cannot calculate analytics without an open vault.');
    }
    const common = { databasePath, requestId: randomUUID(), vaultGeneration };
    const job: AnalyticsJob = { ...common, ...input };
    const request = new Promise<AnalyticsJobResult>((resolve, reject) => {
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
