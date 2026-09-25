import { DATA_RESOURCES, type DataResource } from '../../../shared/desktop-api';

/** Presenter-owned data groups that a committed change can invalidate. */
export const REFRESH_GROUPS = {
  accounts: 'accounts',
  history: 'history',
  instruments: 'instruments',
  settings: 'settings',
  tags: 'tags',
  tradePreferences: 'tradePreferences',
} as const;
export type RefreshGroup = (typeof REFRESH_GROUPS)[keyof typeof REFRESH_GROUPS];
export type RefreshTarget = RefreshGroup | 'all';

export const ALL_REFRESH_GROUPS: readonly RefreshGroup[] = Object.values(REFRESH_GROUPS);

const RESOURCE_GROUPS: Readonly<Record<DataResource, readonly RefreshGroup[]>> = {
  [DATA_RESOURCES.accountInstrumentDefaults]: [REFRESH_GROUPS.instruments],
  [DATA_RESOURCES.accounts]: [REFRESH_GROUPS.accounts],
  [DATA_RESOURCES.applicationSettings]: [REFRESH_GROUPS.settings],
  [DATA_RESOURCES.cashMovements]: [REFRESH_GROUPS.accounts],
  [DATA_RESOURCES.history]: [REFRESH_GROUPS.history],
  [DATA_RESOURCES.instrumentProfiles]: [REFRESH_GROUPS.instruments],
  [DATA_RESOURCES.instruments]: [REFRESH_GROUPS.instruments],
  [DATA_RESOURCES.tags]: [REFRESH_GROUPS.tags],
  [DATA_RESOURCES.tradePreferences]: [REFRESH_GROUPS.tradePreferences],
  // Tag assignments change the catalogue's trade counts.
  [DATA_RESOURCES.tradeTags]: [REFRESH_GROUPS.tags],
  // The table reloads itself from `dataVersion`, while account balances are a
  // projection over saved trade impacts and must be refreshed explicitly.
  [DATA_RESOURCES.trades]: [REFRESH_GROUPS.accounts],
};

/** Maps committed change resources to the presenter data they invalidate. */
export const resolveRefreshGroups = (
  resources: readonly DataResource[],
): readonly RefreshGroup[] => {
  const groups = new Set<RefreshGroup>();
  resources.forEach((resource) => {
    RESOURCE_GROUPS[resource].forEach((group) => groups.add(group));
  });
  return [...groups];
};
