import type { DeletedTagSnapshot, TagStore } from '../contracts/tag-store';

export class DeleteTagsUseCase {
  public constructor(private readonly tagStore: TagStore) {}

  public execute(ids: readonly string[]): readonly DeletedTagSnapshot[] {
    return this.tagStore.deleteTags(ids);
  }
}
