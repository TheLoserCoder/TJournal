import { calculateTradeSummary } from '@tjournal/analytics';
import { SqliteTradeStore, SqliteVaultDatabase } from '@tjournal/platform-database';
import { DATA_RESOURCES, type DataResource } from '../shared/desktop-api';
import {
  parseTradeSummaryJob,
  type TradeSummaryJob,
  type TradeSummaryJobResult,
} from './analytics-worker-contract';

const toPublicRevisions = (
  revisions: Readonly<Record<string, number>>,
): Readonly<Partial<Record<DataResource, number>>> => ({
  [DATA_RESOURCES.accounts]: revisions.accounts ?? 0,
  [DATA_RESOURCES.accountInstrumentDefaults]: revisions['account-instrument-defaults'] ?? 0,
  [DATA_RESOURCES.instrumentProfiles]: revisions['instrument-profiles'] ?? 0,
  [DATA_RESOURCES.instruments]: revisions.instruments ?? 0,
  [DATA_RESOURCES.tradePreferences]: revisions['trade-preferences'] ?? 0,
  [DATA_RESOURCES.trades]: revisions.trades ?? 0,
});

const run = (rawJob: TradeSummaryJob): TradeSummaryJobResult => {
  const job = parseTradeSummaryJob(rawJob);
  const startedAt = Date.now();
  const database = new SqliteVaultDatabase();
  try {
    database.openReadOnly(job.databasePath);
    const tradeStore = new SqliteTradeStore(database);
    const preferences = tradeStore.getTradePreferences();
    const summary = calculateTradeSummary(tradeStore.listTrades(), {
      filters: job.query.filters,
      metric: job.query.metric,
      neutralCostSettings: preferences.neutralCostSettings,
      neutralRange: preferences.neutralRanges[job.query.metric],
      now: new Date(),
      period: job.query.period,
    });
    return {
      durationMs: Date.now() - startedAt,
      requestId: job.requestId,
      revisions: toPublicRevisions(database.getDataRevisions()),
      summary,
      vaultGeneration: job.vaultGeneration,
    };
  } finally {
    database.close();
  }
};

export default run;
