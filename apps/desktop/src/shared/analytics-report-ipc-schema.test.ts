import { describe, expect, it } from 'vitest';

import { analyticsReportRequestSchema } from './analytics-report-ipc-schema';

const validRequest = {
  breakdown: { dimension: 'instrument', limit: 50, metric: 'net-result' },
  filters: {
    accountIds: [],
    categories: [],
    directions: [],
    includeUnassigned: false,
    instrumentIds: [],
  },
  range: { fromInclusive: null, toExclusive: null },
  timeGrain: 'auto',
} as const;

describe('analyticsReportRequestSchema', () => {
  it('accepts an all-time report request', () => {
    expect(analyticsReportRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it('rejects an incomplete or reversed range', () => {
    expect(
      analyticsReportRequestSchema.safeParse({
        ...validRequest,
        range: { fromInclusive: '2026-09-01T00:00:00.000Z', toExclusive: null },
      }).success,
    ).toBe(false);
    expect(
      analyticsReportRequestSchema.safeParse({
        ...validRequest,
        range: {
          fromInclusive: '2026-09-02T00:00:00.000Z',
          toExclusive: '2026-09-01T00:00:00.000Z',
        },
      }).success,
    ).toBe(false);
  });

  it('rejects an unbounded breakdown response', () => {
    expect(
      analyticsReportRequestSchema.safeParse({
        ...validRequest,
        breakdown: { ...validRequest.breakdown, limit: 51 },
      }).success,
    ).toBe(false);
  });

  it('normalizes filter values for deterministic SQL queries', () => {
    const result = analyticsReportRequestSchema.parse({
      ...validRequest,
      filters: {
        ...validRequest.filters,
        accountIds: ['second', 'first', 'second'],
        directions: ['short', 'long', 'short'],
      },
    });

    expect(result.filters.accountIds).toEqual(['first', 'second']);
    expect(result.filters.directions).toEqual(['long', 'short']);
  });
});
