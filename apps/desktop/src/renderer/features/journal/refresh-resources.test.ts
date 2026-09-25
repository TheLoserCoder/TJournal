import { describe, expect, it } from 'vitest';

import { DATA_RESOURCES } from '../../../shared/desktop-api';

import { REFRESH_GROUPS, resolveRefreshGroups } from './refresh-resources';

describe('resolveRefreshGroups', () => {
  it('maps every committed resource to its presenter data group', () => {
    expect(resolveRefreshGroups([DATA_RESOURCES.trades])).toEqual([REFRESH_GROUPS.accounts]);
    expect(resolveRefreshGroups([DATA_RESOURCES.tradeTags])).toEqual([REFRESH_GROUPS.tags]);
    expect(resolveRefreshGroups([DATA_RESOURCES.accounts])).toEqual([REFRESH_GROUPS.accounts]);
    expect(resolveRefreshGroups([DATA_RESOURCES.cashMovements])).toEqual([REFRESH_GROUPS.accounts]);
    expect(resolveRefreshGroups([DATA_RESOURCES.instruments])).toEqual([
      REFRESH_GROUPS.instruments,
    ]);
    expect(resolveRefreshGroups([DATA_RESOURCES.instrumentProfiles])).toEqual([
      REFRESH_GROUPS.instruments,
    ]);
    expect(resolveRefreshGroups([DATA_RESOURCES.accountInstrumentDefaults])).toEqual([
      REFRESH_GROUPS.instruments,
    ]);
    expect(resolveRefreshGroups([DATA_RESOURCES.tags])).toEqual([REFRESH_GROUPS.tags]);
    expect(resolveRefreshGroups([DATA_RESOURCES.history])).toEqual([REFRESH_GROUPS.history]);
    expect(resolveRefreshGroups([DATA_RESOURCES.applicationSettings])).toEqual([
      REFRESH_GROUPS.settings,
    ]);
    expect(resolveRefreshGroups([DATA_RESOURCES.tradePreferences])).toEqual([
      REFRESH_GROUPS.tradePreferences,
    ]);
  });

  it('deduplicates overlapping resources and keeps the first occurrence order', () => {
    expect(
      resolveRefreshGroups([
        DATA_RESOURCES.tradeTags,
        DATA_RESOURCES.tags,
        DATA_RESOURCES.trades,
        DATA_RESOURCES.accounts,
      ]),
    ).toEqual([REFRESH_GROUPS.tags, REFRESH_GROUPS.accounts]);
  });
});
