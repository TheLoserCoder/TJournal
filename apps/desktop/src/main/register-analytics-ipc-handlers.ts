import { ipcMain } from 'electron';

import { analyticsReportRequestSchema } from '../shared/analytics-report-ipc-schema';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { summaryPreferencesSchema } from '../shared/trade-ipc-schemas';
import type { AnalyticsWorkerClient } from './analytics-worker-client';
import type { CommittedChangeCoordinator } from './committed-change-coordinator';
import { asAsyncResult } from './ipc-result';
import type { IpcRegistrationContext } from './ipc-registration-context';
import { parseIpcInput } from './parse-ipc-input';

export interface AnalyticsIpcDependencies {
  readonly analyticsWorkerClient: Pick<AnalyticsWorkerClient, 'runReport' | 'runSummary'>;
  readonly committedChangeCoordinator: Pick<
    CommittedChangeCoordinator,
    'getVaultGeneration' | 'isCurrent'
  >;
}

export const registerAnalyticsIpcHandlers = (
  dependencies: AnalyticsIpcDependencies,
  context: IpcRegistrationContext,
): void => {
  ipcMain.handle(IPC_CHANNELS.analyticsSummary, (_event, input) =>
    asAsyncResult(
      async () => {
        const query = parseIpcInput(summaryPreferencesSchema, input);
        const vaultGeneration = dependencies.committedChangeCoordinator.getVaultGeneration();
        try {
          const result = await dependencies.analyticsWorkerClient.runSummary(
            query,
            vaultGeneration,
          );
          if (
            result.vaultGeneration !== vaultGeneration ||
            !dependencies.committedChangeCoordinator.isCurrent(result.revisions)
          )
            return null;
          return result.summary;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return null;
          throw error;
        }
      },
      context.logger,
      'ipc.analytics-summary.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.analyticsReport, (_event, input) =>
    asAsyncResult(
      async () => {
        const query = parseIpcInput(analyticsReportRequestSchema, input);
        const vaultGeneration = dependencies.committedChangeCoordinator.getVaultGeneration();
        try {
          const result = await dependencies.analyticsWorkerClient.runReport(query, vaultGeneration);
          if (
            result.vaultGeneration !== vaultGeneration ||
            !dependencies.committedChangeCoordinator.isCurrent(result.revisions)
          )
            return null;
          context.logger.info('analytics.report.completed', {
            breakdownRowCount: String(result.report.breakdown.rows.length),
            coveredTrades: String(result.report.coverage.coveredTrades),
            durationMs: String(result.durationMs),
            effectiveGrain: result.report.effectiveRange.grain,
            entryPoint: 'ipc.analytics-report',
            requestId: result.requestId,
            seriesPointCount: String(result.report.series.length),
            totalTrades: String(result.report.coverage.totalTrades),
          });
          return result.report;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return null;
          throw error;
        }
      },
      context.logger,
      'ipc.analytics-report.failed',
    ),
  );
};
