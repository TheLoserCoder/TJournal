import { randomUUID } from 'node:crypto';

import type { TagStore } from '../contracts/tag-store';
import {
  normalizeTagDescription,
  normalizeTagName,
  normalizeTagNameKey,
  requireTagColor,
  type CreateTagInput,
  type Tag,
} from '../domain/tag';
import { suggestTagColor } from '../domain/tag-color';

export class CreateTagUseCase {
  public constructor(private readonly tagStore: TagStore) {}

  public execute(input: CreateTagInput, id: string = randomUUID()): Tag {
    const name = normalizeTagName(input.name);
    const color =
      input.color === undefined
        ? suggestTagColor(this.tagStore.listTags())
        : requireTagColor(input.color);
    return this.tagStore.createTag({
      color,
      description: normalizeTagDescription(input.description),
      id,
      name,
      nameKey: normalizeTagNameKey(name),
    });
  }
}
