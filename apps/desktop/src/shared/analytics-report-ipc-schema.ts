import { z } from 'zod';

import { MAX_ANALYTICS_BREAKDOWN_ROWS, MAX_ANALYTICS_FILTER_VALUES } from '@tjournal/analytics';

const instrumentCategorySchema = z.enum([
  'crypto',
  'energy',
  'equity',
  'etf',
  'forex',
  'index',
  'metal',
]);

const uniqueSortedArray = <T extends z.ZodType<string>>(itemSchema: T) =>
  z
    .array(itemSchema)
    .max(MAX_ANALYTICS_FILTER_VALUES)
    .transform((values) => [...new Set(values)].sort());

export const analyticsReportRequestSchema = z
  .object({
    breakdown: z.object({
      dimension: z.enum(['account', 'instrument', 'category']),
      limit: z.number().int().min(1).max(MAX_ANALYTICS_BREAKDOWN_ROWS),
      metric: z.enum(['net-result', 'win-rate', 'trade-count']),
    }),
    filters: z.object({
      accountIds: uniqueSortedArray(z.string().min(1)),
      categories: uniqueSortedArray(instrumentCategorySchema),
      directions: uniqueSortedArray(z.enum(['long', 'short'])),
      includeUnassigned: z.boolean(),
      instrumentIds: uniqueSortedArray(z.string().min(1)),
    }),
    range: z.object({
      fromInclusive: z.string().datetime().nullable(),
      toExclusive: z.string().datetime().nullable(),
    }),
    timeGrain: z.enum(['auto', 'day', 'hour', 'week', 'month']),
  })
  .superRefine((value, context) => {
    const { fromInclusive, toExclusive } = value.range;
    if ((fromInclusive === null) !== (toExclusive === null)) {
      context.addIssue({
        code: 'custom',
        message: 'Both range boundaries are required.',
        path: ['range'],
      });
      return;
    }
    if (
      fromInclusive !== null &&
      toExclusive !== null &&
      new Date(fromInclusive).getTime() >= new Date(toExclusive).getTime()
    )
      context.addIssue({
        code: 'custom',
        message: 'Range must not be empty or reversed.',
        path: ['range'],
      });
  });
