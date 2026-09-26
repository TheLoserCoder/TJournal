import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { tradeLocalDateTime, updateTradeLocalTime } from './trade-local-time';

const originalTimeZone = process.env.TZ;

describe('trade local date and time', () => {
  beforeAll(() => {
    process.env.TZ = 'Europe/Moscow';
  });

  afterAll(() => {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  });

  it('shows the local calendar day and preserves the UTC instant on an unchanged edit', () => {
    const closedAt = '2026-09-25T23:06:42.123Z';
    expect(tradeLocalDateTime(closedAt)).toEqual({ date: '2026-09-26', time: '02:06' });
    expect(updateTradeLocalTime(closedAt, '2026-09-26T02:06')).toBe(closedAt);
  });

  it('converts edited local wall time to UTC without dropping seconds', () => {
    expect(updateTradeLocalTime('2026-09-25T23:06:42.123Z', '2026-09-27T03:05')).toBe(
      '2026-09-27T00:05:42.123Z',
    );
  });

  it('rejects an invalid local time instead of persisting a normalized instant', () => {
    expect(updateTradeLocalTime('2026-09-25T23:06:42.123Z', '2026-02-30T03:05')).toBeNull();
  });

  it('rejects local times missing during the spring DST transition', () => {
    process.env.TZ = 'Europe/Berlin';
    try {
      expect(updateTradeLocalTime('2026-03-28T23:30:00.000Z', '2026-03-29T02:30')).toBeNull();
      expect(updateTradeLocalTime('2026-03-28T23:30:00.000Z', '2026-03-29T03:30')).toBe(
        '2026-03-29T01:30:00.000Z',
      );
    } finally {
      process.env.TZ = 'Europe/Moscow';
    }
  });
});
