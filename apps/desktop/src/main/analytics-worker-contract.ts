import { z } from 'zod';

import type { DataResource, TradeSummaryDto, TradeSummaryRequestDto } from '../shared/desktop-api';
import { summaryPreferencesSchema } from '../shared/trade-ipc-schemas';

export interface TradeSummaryJob {
  readonly databasePath: string;
  readonly query: TradeSummaryRequestDto;
  readonly requestId: string;
  readonly vaultGeneration: string;
}

export interface TradeSummaryJobResult {
  readonly durationMs: number;
  readonly requestId: string;
  readonly revisions: Readonly<Partial<Record<DataResource, number>>>;
  readonly summary: TradeSummaryDto;
  readonly vaultGeneration: string;
}

const tradeSummaryJobSchema = z.object({
  databasePath: z.string().min(1),
  query: summaryPreferencesSchema,
  requestId: z.string().min(1),
  vaultGeneration: z.string().min(1),
});

export const parseTradeSummaryJob = (input: unknown): TradeSummaryJob =>
  tradeSummaryJobSchema.parse(input) as TradeSummaryJob;
