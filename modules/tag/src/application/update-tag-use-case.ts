import type { TagStore } from '../contracts/tag-store';
import {
  normalizeTagDescription,
  normalizeTagName,
  normalizeTagNameKey,
  requireTagColor,
  type Tag,
  type UpdateTagInput,
} from '../domain/tag';

export class UpdateTagUseCase {
  public constructor(private readonly tagStore: TagStore) {}

  public execute(input: UpdateTagInput): Tag {
    const name = normalizeTagName(input.name);
    return this.tagStore.updateTag({
      color: requireTagColor(input.color),
      description: normalizeTagDescription(input.description),
      id: input.id,
      name,
      nameKey: normalizeTagNameKey(name),
    });
  }
}
