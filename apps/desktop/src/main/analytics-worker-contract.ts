import { z } from 'zod';

import type {
  AnalyticsReportDto,
  AnalyticsReportRequestDto,
  DataResource,
  TradeSummaryDto,
  TradeSummaryRequestDto,
} from '../shared/desktop-api';
import { analyticsReportRequestSchema } from '../shared/analytics-report-ipc-schema';
import { summaryPreferencesSchema } from '../shared/trade-ipc-schemas';

export interface TradeSummaryJob {
  readonly databasePath: string;
  readonly kind: 'summary';
  readonly query: TradeSummaryRequestDto;
  readonly requestId: string;
  readonly vaultGeneration: string;
}

export interface TradeSummaryJobResult {
  readonly durationMs: number;
  readonly kind: 'summary';
  readonly requestId: string;
  readonly revisions: Readonly<Partial<Record<DataResource, number>>>;
  readonly summary: TradeSummaryDto;
  readonly vaultGeneration: string;
}

export interface AnalyticsReportJob {
  readonly databasePath: string;
  readonly kind: 'report';
  readonly query: AnalyticsReportRequestDto;
  readonly requestId: string;
  readonly vaultGeneration: string;
}

export interface AnalyticsReportJobResult {
  readonly durationMs: number;
  readonly kind: 'report';
  readonly report: AnalyticsReportDto;
  readonly requestId: string;
  readonly revisions: Readonly<Partial<Record<DataResource, number>>>;
  readonly vaultGeneration: string;
}

export type AnalyticsJob = AnalyticsReportJob | TradeSummaryJob;
export type AnalyticsJobResult = AnalyticsReportJobResult | TradeSummaryJobResult;

const tradeSummaryJobSchema = z.object({
  databasePath: z.string().min(1),
  kind: z.literal('summary'),
  query: summaryPreferencesSchema,
  requestId: z.string().min(1),
  vaultGeneration: z.string().min(1),
});

const analyticsReportJobSchema = z.object({
  databasePath: z.string().min(1),
  kind: z.literal('report'),
  query: analyticsReportRequestSchema,
  requestId: z.string().min(1),
  vaultGeneration: z.string().min(1),
});

const analyticsJobSchema = z.discriminatedUnion('kind', [
  tradeSummaryJobSchema,
  analyticsReportJobSchema,
]);

export const parseAnalyticsJob = (input: unknown): AnalyticsJob => analyticsJobSchema.parse(input);
