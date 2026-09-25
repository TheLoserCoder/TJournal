import type { Tag, TagColorId } from '../domain/tag';

/** Persistence shape already normalised by the application layer. */
export interface StoredTagInput {
  readonly color: TagColorId;
  readonly description: string;
  readonly id: string;
  readonly name: string;
  readonly nameKey: string;
}

/** Everything needed to restore a deleted tag together with its trade links. */
export interface DeletedTagSnapshot {
  readonly tag: Tag;
  readonly tradeIds: readonly string[];
}

export interface TagStore {
  countTradesByTag(): Readonly<Record<string, number>>;
  createTag(input: StoredTagInput): Tag;
  deleteTags(ids: readonly string[]): readonly DeletedTagSnapshot[];
  /**
   * Structural implementation of the trade-owned tag reference port: returns the
   * subset of ids that currently exist as tags.
   */
  filterExistingTagIds(ids: readonly string[]): readonly string[];
  getTagById(id: string): Tag | null;
  listTags(): readonly Tag[];
  restoreTags(snapshots: readonly DeletedTagSnapshot[]): void;
  updateTag(input: StoredTagInput): Tag;
}
