import { describe, expect, it } from 'vitest';

import { journalPageRequestSchema } from './journal-page-ipc-schema';

const validRequest = () => ({
  cursor: null,
  filters: {
    accountIds: [],
    categories: [],
    closedFromDate: null,
    closedToDate: null,
    entryKinds: [],
    includeUntagged: false,
    includeUnassigned: false,
    instrumentIds: [],
    occurredFrom: null,
    occurredTo: null,
    resultBounds: null,
    resultUnits: [],
    tagIds: [],
    textQuery: null,
  },
  includeCashMovements: true,
  limit: 100,
  sort: { direction: 'desc', field: 'date' },
});

describe('journalPageRequestSchema', () => {
  it('accepts a bounded valid request', () => {
    const parsed = journalPageRequestSchema.safeParse(validRequest());
    expect(parsed.success).toBe(true);
  });

  it('rejects an out-of-range page size and unknown sort fields', () => {
    expect(journalPageRequestSchema.safeParse({ ...validRequest(), limit: 0 }).success).toBe(false);
    expect(journalPageRequestSchema.safeParse({ ...validRequest(), limit: 201 }).success).toBe(
      false,
    );
    expect(
      journalPageRequestSchema.safeParse({
        ...validRequest(),
        sort: { direction: 'desc', field: 'tags' },
      }).success,
    ).toBe(false);
  });

  it('rejects malformed date keys, instants and bound modes', () => {
    const request = validRequest();
    expect(
      journalPageRequestSchema.safeParse({
        ...request,
        filters: { ...request.filters, closedFromDate: '21.09.2026' },
      }).success,
    ).toBe(false);
    expect(
      journalPageRequestSchema.safeParse({
        ...request,
        filters: { ...request.filters, closedFromDate: '2026-99-99' },
      }).success,
    ).toBe(false);
    expect(
      journalPageRequestSchema.safeParse({
        ...request,
        filters: { ...request.filters, occurredFrom: 'yesterday' },
      }).success,
    ).toBe(false);
    expect(
      journalPageRequestSchema.safeParse({
        ...request,
        filters: {
          ...request.filters,
          resultBounds: { maximum: null, minimum: '1', mode: 'greater-than' },
        },
      }).success,
    ).toBe(false);
  });

  it('rejects non-decimal, incomplete and reversed result bounds', () => {
    const request = validRequest();
    const parseBounds = (resultBounds: unknown) =>
      journalPageRequestSchema.safeParse({
        ...request,
        filters: { ...request.filters, resultBounds },
      }).success;

    expect(parseBounds({ maximum: null, minimum: 'not-a-number', mode: 'greaterThan' })).toBe(
      false,
    );
    expect(parseBounds({ maximum: null, minimum: null, mode: 'greaterThan' })).toBe(false);
    expect(parseBounds({ maximum: '1', minimum: '2', mode: 'between' })).toBe(false);
    expect(parseBounds({ maximum: '2', minimum: '1', mode: 'between' })).toBe(true);
  });
});
