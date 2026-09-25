import type { TagStore } from '../contracts/tag-store';
import type { Tag } from '../domain/tag';

export class ListTagsUseCase {
  public constructor(private readonly tagStore: TagStore) {}

  public execute(): readonly Tag[] {
    return this.tagStore.listTags();
  }
}
