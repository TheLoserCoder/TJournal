import { randomUUID } from 'node:crypto';

import {
  DATA_RESOURCES,
  type CommittedDataChangeDto,
  type DataResource,
} from '../shared/desktop-api';
import type { SqliteVaultDatabase } from '@tjournal/platform-database';

type DatabaseResource =
  | 'accounts'
  | 'account-instrument-defaults'
  | 'cash-movements'
  | 'instruments'
  | 'instrument-profiles'
  | 'tags'
  | 'trade-preferences'
  | 'trade-tags'
  | 'trades';

const DATABASE_RESOURCE_TO_PUBLIC_RESOURCE: Readonly<Record<DatabaseResource, DataResource>> = {
  accounts: DATA_RESOURCES.accounts,
  'account-instrument-defaults': DATA_RESOURCES.accountInstrumentDefaults,
  'cash-movements': DATA_RESOURCES.cashMovements,
  instruments: DATA_RESOURCES.instruments,
  'instrument-profiles': DATA_RESOURCES.instrumentProfiles,
  tags: DATA_RESOURCES.tags,
  'trade-preferences': DATA_RESOURCES.tradePreferences,
  'trade-tags': DATA_RESOURCES.tradeTags,
  trades: DATA_RESOURCES.trades,
};

const unique = (resources: readonly DataResource[]): readonly DataResource[] => [
  ...new Set(resources),
];

export class CommittedChangeCoordinator {
  private generation = randomUUID();
  private revisions: Readonly<Record<string, number>> = {};

  public constructor(private readonly vaultDatabase: SqliteVaultDatabase) {}

  public resetForVault(): CommittedDataChangeDto {
    this.generation = randomUUID();
    this.revisions = this.vaultDatabase.getDataRevisions();
    return {
      changeId: randomUUID(),
      resources: [
        DATA_RESOURCES.applicationSettings,
        DATA_RESOURCES.accounts,
        DATA_RESOURCES.accountInstrumentDefaults,
        DATA_RESOURCES.cashMovements,
        DATA_RESOURCES.history,
        DATA_RESOURCES.instrumentProfiles,
        DATA_RESOURCES.instruments,
        DATA_RESOURCES.tags,
        DATA_RESOURCES.tradePreferences,
        DATA_RESOURCES.tradeTags,
        DATA_RESOURCES.trades,
      ],
      revisions: this.toPublicRevisions(this.revisions),
      vaultGeneration: this.generation,
    };
  }

  public capture(resources: readonly DataResource[] = []): CommittedDataChangeDto | null {
    const next = this.vaultDatabase.getDataRevisions();
    const changedDatabaseResources = Object.keys(next).filter(
      (resource) => next[resource] !== this.revisions[resource],
    ) as DatabaseResource[];
    const changed = unique([
      ...resources,
      ...changedDatabaseResources.map((resource) => DATABASE_RESOURCE_TO_PUBLIC_RESOURCE[resource]),
    ]);
    this.revisions = next;
    if (changed.length === 0) return null;
    return {
      changeId: randomUUID(),
      resources: changed,
      revisions: this.toPublicRevisions(next),
      vaultGeneration: this.generation,
    };
  }

  public captureApplicationChange(resources: readonly DataResource[]): CommittedDataChangeDto {
    return {
      changeId: randomUUID(),
      resources: unique(resources),
      revisions: this.toPublicRevisions(this.revisions),
      vaultGeneration: this.generation,
    };
  }

  public getVaultGeneration(): string {
    return this.generation;
  }

  public isCurrent(revisions: Readonly<Partial<Record<DataResource, number>>>): boolean {
    const current = this.toPublicRevisions(this.vaultDatabase.getDataRevisions());
    return Object.entries(revisions).every(
      ([resource, revision]) => current[resource as DataResource] === revision,
    );
  }

  private toPublicRevisions(
    revisions: Readonly<Record<string, number>>,
  ): Readonly<Partial<Record<DataResource, number>>> {
    return Object.fromEntries(
      Object.entries(DATABASE_RESOURCE_TO_PUBLIC_RESOURCE).map(
        ([databaseResource, publicResource]) => [publicResource, revisions[databaseResource] ?? 0],
      ),
    );
  }
}
