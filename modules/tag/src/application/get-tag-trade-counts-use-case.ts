import type { TagStore } from '../contracts/tag-store';

/** Trade usage counts per tag for the catalogue table. */
export class GetTagTradeCountsUseCase {
  public constructor(private readonly tagStore: TagStore) {}

  public execute(): Readonly<Record<string, number>> {
    return this.tagStore.countTradesByTag();
  }
}
