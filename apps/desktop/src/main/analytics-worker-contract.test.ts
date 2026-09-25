import { describe, expect, it } from 'vitest';

import { parseAnalyticsJob } from './analytics-worker-contract';

const common = {
  databasePath: '/vault/journal.sqlite',
  requestId: 'request-1',
  vaultGeneration: 'generation-1',
};
const summaryQuery = {
  filters: {
    accountIds: null,
    closedFrom: null,
    closedTo: null,
    instrumentIds: null,
    resultKinds: null,
  },
  metric: 'cash',
  period: 'all',
};
const reportQuery = {
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
};

describe('parseAnalyticsJob', () => {
  it('parses both discriminated job kinds', () => {
    expect(parseAnalyticsJob({ ...common, kind: 'summary', query: summaryQuery }).kind).toBe(
      'summary',
    );
    const report = parseAnalyticsJob({ ...common, kind: 'report', query: reportQuery });
    expect(report.kind).toBe('report');
    if (report.kind === 'report') expect(report.query.breakdown.dimension).toBe('instrument');
  });

  it('rejects a job without the kind discriminator', () => {
    expect(() => parseAnalyticsJob({ ...common, query: summaryQuery })).toThrow();
  });

  it('rejects an invalid report query at the worker boundary', () => {
    expect(() =>
      parseAnalyticsJob({
        ...common,
        kind: 'report',
        query: { ...reportQuery, timeGrain: 'quarter' },
      }),
    ).toThrow();
  });
});
