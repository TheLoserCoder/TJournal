import { z } from 'zod';
import Decimal from 'decimal.js';

import { MAX_JOURNAL_TABLE_PAGE_SIZE } from '@tjournal/trade';

const cursorSchema = z.string().min(1).max(2048);
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const dateKeySchema = z.string().refine((value) => {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
});
const instantSchema = z.string().datetime();
const identifierSchema = z.string().min(1);
const resultKindSchema = z.enum(['cash', 'percent', 'r']);
const identifierListSchema = z.array(identifierSchema).max(MAX_JOURNAL_TABLE_PAGE_SIZE);
const decimalStringSchema = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      return new Decimal(value).isFinite();
    } catch {
      return false;
    }
  });

const resultBoundsSchema = z
  .object({
    maximum: decimalStringSchema.nullable(),
    minimum: decimalStringSchema.nullable(),
    mode: z.enum(['between', 'equals', 'greaterThan', 'lessThan']),
  })
  .superRefine((bounds, context) => {
    const requiredValue =
      bounds.mode === 'lessThan'
        ? bounds.maximum
        : bounds.mode === 'between'
          ? null
          : bounds.minimum;
    if (bounds.mode === 'between' && (bounds.minimum === null || bounds.maximum === null)) {
      context.addIssue({ code: 'custom', message: 'Both bounds are required.' });
      return;
    }
    if (bounds.mode !== 'between' && requiredValue === null) {
      context.addIssue({ code: 'custom', message: 'The selected bound is required.' });
      return;
    }
    if (
      bounds.mode === 'between' &&
      bounds.minimum !== null &&
      bounds.maximum !== null &&
      new Decimal(bounds.minimum).greaterThan(bounds.maximum)
    ) {
      context.addIssue({ code: 'custom', message: 'The minimum must not exceed the maximum.' });
    }
  });

const detailNumericFieldSchema = z.enum([
  'commission',
  'entryPrice',
  'exitCount',
  'quantity',
  'spread',
  'stopLoss',
]);

export const journalPageRequestSchema = z.object({
  cursor: cursorSchema.nullable(),
  filters: z.object({
    accountIds: identifierListSchema,
    categories: z.array(z.enum(['crypto', 'energy', 'equity', 'etf', 'forex', 'index', 'metal'])),
    closedFromDate: dateKeySchema.nullable(),
    closedToDate: dateKeySchema.nullable(),
    detailBounds: z.record(detailNumericFieldSchema, resultBoundsSchema).nullable(),
    entryKinds: z.array(z.enum(['deposit', 'long', 'short', 'withdrawal'])),
    includeUntagged: z.boolean(),
    includeUnassigned: z.boolean(),
    instrumentIds: identifierListSchema,
    notePresence: z.array(z.enum(['entry', 'review'])),
    occurredFrom: instantSchema.nullable(),
    occurredTo: instantSchema.nullable(),
    resultBounds: resultBoundsSchema.nullable(),
    resultUnits: z.array(resultKindSchema),
    reviewStatuses: z.array(z.enum(['unreviewed', 'reviewed'])),
    tagIds: identifierListSchema,
    textQuery: z.string().max(200).nullable(),
  }),
  includeCashMovements: z.boolean(),
  limit: z.number().int().min(1).max(MAX_JOURNAL_TABLE_PAGE_SIZE),
  sort: z.object({
    direction: z.enum(['asc', 'desc']),
    field: z.enum(['account', 'asset', 'date', 'result', 'type']),
  }),
});

export type JournalPageRequestInput = z.infer<typeof journalPageRequestSchema>;
