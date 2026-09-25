import type { TagStore } from '../contracts/tag-store';
import type { Tag } from '../domain/tag';

/** Point lookup for a single tag without loading the catalog. */
export class GetTagByIdUseCase {
  public constructor(private readonly tagStore: TagStore) {}

  public execute(id: string): Tag | null {
    return this.tagStore.getTagById(id);
  }
}
