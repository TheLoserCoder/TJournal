import { AppError } from '@tjournal/platform-errors';
import {
  TAG_VALIDATION_CODES,
  TagValidationError,
  normalizeTagNameKey,
  requireTagColor,
  type DeletedTagSnapshot,
  type StoredTagInput,
  type Tag,
  type TagStore,
} from '@tjournal/tag';

import { SqliteVaultDatabase } from './sqlite-vault-database';

interface TagRow {
  readonly color: string;
  readonly created_at: string;
  readonly description: string;
  readonly id: string;
  readonly name: string;
  readonly updated_at: string;
}

const INSERT_TAG_SQL =
  'INSERT INTO tags (id, name, name_key, description, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)';

export class SqliteTagStore implements TagStore {
  public constructor(private readonly vaultDatabase: SqliteVaultDatabase) {}

  public countTradesByTag(): Readonly<Record<string, number>> {
    const rows = this.vaultDatabase
      .require()
      .prepare('SELECT tag_id, COUNT(*) AS count FROM trade_tags GROUP BY tag_id')
      .all() as unknown as readonly { readonly count: number; readonly tag_id: string }[];
    return Object.fromEntries(rows.map((row) => [row.tag_id, Number(row.count)]));
  }

  public createTag(input: StoredTagInput): Tag {
    const now = new Date().toISOString();
    try {
      this.vaultDatabase
        .require()
        .prepare(INSERT_TAG_SQL)
        .run(input.id, input.name, input.nameKey, input.description, input.color, now, now);
    } catch (error) {
      throw toTagWriteError(error);
    }
    return this.require(input.id);
  }

  public deleteTags(ids: readonly string[]): readonly DeletedTagSnapshot[] {
    return this.vaultDatabase.transaction(() =>
      ids.map((id) => {
        const tag = this.require(id);
        const tradeIds = this.listTradeIds(id);
        this.vaultDatabase.require().prepare('DELETE FROM tags WHERE id = ?').run(id);
        return { tag, tradeIds };
      }),
    );
  }

  public filterExistingTagIds(ids: readonly string[]): readonly string[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = this.vaultDatabase
      .require()
      .prepare(`SELECT id FROM tags WHERE id IN (${placeholders})`)
      .all(...ids) as unknown as readonly { readonly id: string }[];
    const existing = new Set(rows.map((row) => row.id));
    return ids.filter((id) => existing.has(id));
  }

  public listTags(): readonly Tag[] {
    const rows = this.vaultDatabase
      .require()
      .prepare('SELECT * FROM tags ORDER BY created_at, id')
      .all() as unknown as readonly TagRow[];
    return rows.map((row) => this.map(row));
  }

  public restoreTags(snapshots: readonly DeletedTagSnapshot[]): void {
    if (snapshots.length === 0) return;
    const database = this.vaultDatabase.require();
    this.vaultDatabase.transaction(() => {
      for (const { tag, tradeIds } of snapshots) {
        database
          .prepare(
            'INSERT OR IGNORE INTO tags (id, name, name_key, description, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          )
          .run(
            tag.id,
            tag.name,
            normalizeTagNameKey(tag.name),
            tag.description,
            tag.color,
            tag.createdAt,
            tag.updatedAt,
          );
        // A concurrently recreated tag name or a removed trade must not abort the restore.
        const link = database.prepare(
          `INSERT OR IGNORE INTO trade_tags (trade_id, tag_id)
           SELECT ?, ? WHERE EXISTS (SELECT 1 FROM tags WHERE id = ?)
             AND EXISTS (SELECT 1 FROM trades WHERE id = ?)`,
        );
        for (const tradeId of tradeIds) link.run(tradeId, tag.id, tag.id, tradeId);
      }
    });
  }

  public updateTag(input: StoredTagInput): Tag {
    this.require(input.id);
    try {
      const result = this.vaultDatabase
        .require()
        .prepare(
          'UPDATE tags SET name = ?, name_key = ?, description = ?, color = ?, updated_at = ? WHERE id = ?',
        )
        .run(
          input.name,
          input.nameKey,
          input.description,
          input.color,
          new Date().toISOString(),
          input.id,
        );
      if (result.changes === 0) {
        throw new AppError({ code: 'vault-invalid', message: 'Tag does not exist.' });
      }
    } catch (error) {
      throw toTagWriteError(error);
    }
    return this.require(input.id);
  }

  private listTradeIds(tagId: string): readonly string[] {
    const rows = this.vaultDatabase
      .require()
      .prepare('SELECT trade_id FROM trade_tags WHERE tag_id = ? ORDER BY trade_id')
      .all(tagId) as unknown as readonly { readonly trade_id: string }[];
    return rows.map((row) => row.trade_id);
  }

  private map(row: TagRow): Tag {
    return {
      color: requireTagColor(row.color),
      createdAt: row.created_at,
      description: row.description,
      id: row.id,
      name: row.name,
      updatedAt: row.updated_at,
    };
  }

  public getTagById(id: string): Tag | null {
    const row = this.vaultDatabase.require().prepare('SELECT * FROM tags WHERE id = ?').get(id) as
      TagRow | undefined;
    return row === undefined ? null : this.map(row);
  }

  private require(id: string): Tag {
    const tag = this.getTagById(id);
    if (tag === null) throw new AppError({ code: 'vault-invalid', message: 'Tag does not exist.' });
    return tag;
  }
}

const toTagWriteError = (error: unknown): unknown => {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : '';
  if (message.includes('UNIQUE constraint failed')) {
    return new TagValidationError([{ code: TAG_VALIDATION_CODES.nameDuplicate, path: 'name' }]);
  }
  return new AppError({
    cause: error,
    code: 'configuration-invalid',
    message: 'Tag could not be saved.',
  });
};
