import type { DeletedTagSnapshot, TagStore } from '../contracts/tag-store';

export class RestoreTagsUseCase {
  public constructor(private readonly tagStore: TagStore) {}

  public execute(snapshots: readonly DeletedTagSnapshot[]): void {
    this.tagStore.restoreTags(snapshots);
  }
}
