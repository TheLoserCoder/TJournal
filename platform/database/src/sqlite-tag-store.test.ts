// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  CreateTagUseCase,
  DeleteTagsUseCase,
  ListTagsUseCase,
  RestoreTagsUseCase,
  UpdateTagUseCase,
} from '@tjournal/tag';
import { TRADE_RESULT_SOURCES, type ClosedTrade } from '@tjournal/trade';

import { SqliteInstrumentStore } from './sqlite-instrument-store';
import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteTagStore } from './sqlite-tag-store';
import { SqliteTradeStore } from './sqlite-trade-store';
import { SqliteVaultDatabase } from './sqlite-vault-database';

const withVault = (run: (context: ReturnType<typeof openVault>) => void): void => {
  const parent = mkdtempSync(join(tmpdir(), 'tjournal-tags-'));
  const context = openVault(parent);
  try {
    run(context);
  } finally {
    context.database.close();
    rmSync(parent, { force: true, recursive: true });
  }
};

const openVault = (parent: string) => {
  const database = new SqliteVaultDatabase();
  const storage = new SqliteJournalStorage(database);
  storage.createVault(join(parent, 'vault'));
  const instrument = new SqliteInstrumentStore(database).listInstruments()[0];
  if (instrument === undefined) throw new Error('Seed instrument is missing.');
  return {
    database,
    instrumentId: instrument.id,
    tags: new SqliteTagStore(database),
    trades: new SqliteTradeStore(database),
  };
};

const tradeInput = (
  instrumentId: string,
  id: string,
  tagIds: readonly string[],
): Omit<ClosedTrade, 'instrumentSymbol'> => ({
  closedAt: '2026-09-13T12:00:00.000Z',
  direction: 'long',
  entryNote: null,
  execution: null,
  id,
  instrumentId,
  resultKind: 'cash',
  resultSource: TRADE_RESULT_SOURCES.manual,
  resultValue: '10',
  reviewNote: null,
  reviewStatus: 'unreviewed',
  riskBindingSnapshot: null,
  tagIds,
});

describe('SqliteTagStore', () => {
  it('creates, lists, updates and deletes tags', () => {
    withVault(({ tags }) => {
      const create = new CreateTagUseCase(tags);
      const list = new ListTagsUseCase(tags);
      const update = new UpdateTagUseCase(tags);
      const remove = new DeleteTagsUseCase(tags);

      const first = create.execute(
        { description: 'trend continuation', name: 'Breakout' },
        'tag-1',
      );
      expect(first.color).toBe('indigo');
      expect(first.name).toBe('Breakout');

      const second = create.execute({ name: 'News' }, 'tag-2');
      expect(second.color).not.toBe(first.color);

      expect(list.execute()).toHaveLength(2);

      const updated = update.execute({
        color: 'rose',
        description: 'changed',
        id: 'tag-1',
        name: 'Breakout 2',
      });
      expect(updated.name).toBe('Breakout 2');
      expect(updated.color).toBe('rose');

      const deleted = remove.execute(['tag-2']);
      expect(deleted).toHaveLength(1);
      expect(deleted[0]?.tag.id).toBe('tag-2');
      expect(list.execute()).toHaveLength(1);
    });
  });

  it('rejects a duplicate name regardless of case', () => {
    withVault(({ tags }) => {
      const create = new CreateTagUseCase(tags);
      create.execute({ name: 'Breakout' }, 'tag-1');
      expect(() => create.execute({ name: 'breakout' }, 'tag-2')).toThrow();
    });
  });

  it('persists trade assignments, replaces them and cascades on delete', () => {
    withVault(({ instrumentId, tags, trades }) => {
      const create = new CreateTagUseCase(tags);
      const remove = new DeleteTagsUseCase(tags);
      create.execute({ name: 'A' }, 'tag-a');
      create.execute({ name: 'B' }, 'tag-b');

      trades.createTrade(tradeInput(instrumentId, 'trade-1', ['tag-a', 'tag-b']));
      trades.createTrade(tradeInput(instrumentId, 'trade-2', []));

      const listed = trades.listTrades();
      expect(listed.find((trade) => trade.id === 'trade-1')?.tagIds).toEqual(['tag-a', 'tag-b']);
      expect(listed.find((trade) => trade.id === 'trade-2')?.tagIds).toEqual([]);

      const persisted = listed.find((trade) => trade.id === 'trade-1');
      if (persisted === undefined) throw new Error('Trade is missing.');
      trades.updateTrade({ ...persisted, tagIds: ['tag-b'] });
      expect(trades.listTrades().find((trade) => trade.id === 'trade-1')?.tagIds).toEqual([
        'tag-b',
      ]);

      const deleted = remove.execute(['tag-b']);
      expect(deleted[0]?.tradeIds).toEqual(['trade-1']);
      expect(trades.listTrades().find((trade) => trade.id === 'trade-1')?.tagIds).toEqual([]);
    });
  });

  it('restores tags and their links after deletion', () => {
    withVault(({ instrumentId, tags, trades }) => {
      const create = new CreateTagUseCase(tags);
      const remove = new DeleteTagsUseCase(tags);
      const restore = new RestoreTagsUseCase(tags);
      const list = new ListTagsUseCase(tags);
      create.execute({ name: 'A' }, 'tag-a');
      trades.createTrade(tradeInput(instrumentId, 'trade-1', ['tag-a']));

      const snapshots = remove.execute(['tag-a']);
      expect(list.execute()).toHaveLength(0);
      restore.execute(snapshots);

      expect(list.execute()).toHaveLength(1);
      expect(trades.listTrades().find((trade) => trade.id === 'trade-1')?.tagIds).toEqual([
        'tag-a',
      ]);
    });
  });

  it('removes assignments when the trade is deleted', () => {
    withVault(({ instrumentId, tags, trades }) => {
      createTag(tags, 'tag-a', 'A');
      trades.createTrade(tradeInput(instrumentId, 'trade-1', ['tag-a']));
      trades.deleteTrade('trade-1');
      expect(tags.filterExistingTagIds(['tag-a'])).toEqual(['tag-a']);
      expect(tags.listTags()).toHaveLength(1);
    });
  });

  it('bumps dedicated tag revisions', () => {
    withVault(({ database, tags }) => {
      const before = database.getDataRevisions();
      createTag(tags, 'tag-a', 'A');
      const after = database.getDataRevisions();
      expect(after.tags).toBe((before.tags ?? 0) + 1);
      expect(after['trade-tags']).toBe(before['trade-tags'] ?? 0);
    });
  });
});

const createTag = (tags: SqliteTagStore, id: string, name: string): void => {
  new CreateTagUseCase(tags).execute({ name }, id);
};
