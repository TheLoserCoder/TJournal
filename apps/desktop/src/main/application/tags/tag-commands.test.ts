import { describe, expect, it, vi } from 'vitest';

import type { CreateTagInput, DeletedTagSnapshot, Tag, UpdateTagInput } from '@tjournal/tag';

import { DATA_RESOURCES } from '../../../shared/desktop-api';
import { UndoRedoHistory } from '../../history/undo-redo-history';
import { TagCommands } from './tag-commands';

const makeTag = (overrides: Partial<Tag> = {}): Tag => ({
  color: 'blue',
  createdAt: '2026-01-01T00:00:00.000Z',
  description: 'Momentum setup',
  id: 'tag-1',
  name: 'Breakout',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const createHarness = () => {
  const history = new UndoRedoHistory();
  const createTagUseCase = {
    execute: vi.fn((input: CreateTagInput, id = 'tag-created'): Tag =>
      makeTag({ id, name: input.name }),
    ),
  };
  const updateTagUseCase = {
    execute: vi.fn((input: UpdateTagInput): Tag => makeTag(input)),
  };
  const getTagByIdUseCase = {
    execute: vi.fn((id: string): Tag | null => (id === 'tag-1' ? makeTag() : null)),
  };
  const deleteTagsUseCase = {
    execute: vi.fn((ids: readonly string[]): readonly DeletedTagSnapshot[] =>
      ids.map((id) => ({ tag: makeTag({ id }), tradeIds: ['trade-1'] })),
    ),
  };
  const restoreTagsUseCase = { execute: vi.fn() };
  const commands = new TagCommands(
    history,
    createTagUseCase,
    updateTagUseCase,
    getTagByIdUseCase,
    deleteTagsUseCase,
    restoreTagsUseCase,
  );
  return {
    commands,
    createTagUseCase,
    deleteTagsUseCase,
    getTagByIdUseCase,
    history,
    restoreTagsUseCase,
    updateTagUseCase,
  };
};

describe('TagCommands', () => {
  it('creates a tag and undoes it by deleting the same id', () => {
    const { commands, createTagUseCase, deleteTagsUseCase, history } = createHarness();

    const outcome = commands.create({ name: 'Breakout' });

    expect(outcome.value.id).toBe('tag-created');
    expect(outcome.changedResources).toEqual([
      DATA_RESOURCES.history,
      DATA_RESOURCES.tags,
      DATA_RESOURCES.tradeTags,
    ]);
    expect(createTagUseCase.execute).toHaveBeenCalledWith({ name: 'Breakout' }, undefined);

    history.undo();
    expect(deleteTagsUseCase.execute).toHaveBeenCalledWith(['tag-created']);
  });

  it('recreates a tag with its original id on redo', () => {
    const { commands, createTagUseCase, history } = createHarness();

    commands.create({ name: 'Breakout' });
    history.undo();
    history.redo();

    expect(createTagUseCase.execute).toHaveBeenCalledTimes(2);
    expect(createTagUseCase.execute.mock.calls[1]?.[1]).toBe('tag-created');
  });

  it('updates a tag and restores the exact previous snapshot on undo', () => {
    const { commands, history, updateTagUseCase } = createHarness();
    const input: UpdateTagInput = {
      color: 'rose',
      description: 'Reversal',
      id: 'tag-1',
      name: 'Reversal',
    };

    commands.update(input);
    expect(updateTagUseCase.execute).toHaveBeenCalledWith(input);

    history.undo();
    expect(updateTagUseCase.execute).toHaveBeenCalledWith(makeTag());
  });

  it('refuses to update an unknown tag without touching history', () => {
    const { commands, history, updateTagUseCase } = createHarness();

    expect(() =>
      commands.update({ color: 'rose', description: '', id: 'missing', name: 'X' }),
    ).toThrow('Tag not found.');
    expect(updateTagUseCase.execute).not.toHaveBeenCalled();
    expect(history.getState().canUndo).toBe(false);
  });

  it('deletes many tags and restores the captured snapshots on undo', () => {
    const { commands, history, restoreTagsUseCase } = createHarness();

    const outcome = commands.deleteMany(['tag-1', 'tag-2']);

    expect(outcome.value.map((tag) => tag.id)).toEqual(['tag-1', 'tag-2']);
    expect(outcome.changedResources).toEqual([
      DATA_RESOURCES.history,
      DATA_RESOURCES.tags,
      DATA_RESOURCES.tradeTags,
    ]);

    history.undo();
    expect(restoreTagsUseCase.execute).toHaveBeenCalledWith([
      { tag: makeTag({ id: 'tag-1' }), tradeIds: ['trade-1'] },
      { tag: makeTag({ id: 'tag-2' }), tradeIds: ['trade-1'] },
    ]);
  });
});
