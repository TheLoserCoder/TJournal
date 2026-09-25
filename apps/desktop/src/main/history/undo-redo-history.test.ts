import { describe, expect, it, vi } from 'vitest';

import { UndoRedoHistory } from './undo-redo-history';

describe('UndoRedoHistory', () => {
  it('clears the undo and redo stacks on reset', () => {
    const history = new UndoRedoHistory();
    history.execute({ execute: () => undefined, label: 'first', undo: () => undefined });
    history.undo();

    history.reset();

    expect(history.getState()).toEqual({
      canRedo: false,
      canUndo: false,
      redoLabel: null,
      undoLabel: null,
    });
  });

  it('never replays a dropped command after reset', () => {
    const execute = vi.fn();
    const undo = vi.fn();
    const history = new UndoRedoHistory();
    history.execute({ execute, label: 'trade.create', undo });
    execute.mockClear();

    history.reset();

    expect(history.undo()).toBe(false);
    expect(history.redo()).toBe(false);
    expect(execute).not.toHaveBeenCalled();
    expect(undo).not.toHaveBeenCalled();
  });

  it('keeps a failed undo retryable and out of the redo stack', () => {
    const undo = vi.fn((): void => {
      throw new Error('inverse failed');
    });
    const history = new UndoRedoHistory();
    history.execute({ execute: () => undefined, label: 'trade.create', undo });

    expect(() => history.undo()).toThrow('inverse failed');
    expect(history.getState()).toEqual({
      canRedo: false,
      canUndo: true,
      redoLabel: null,
      undoLabel: 'trade.create',
    });

    undo.mockImplementation(() => undefined);
    expect(history.undo()).toBe(true);
    expect(history.getState()).toEqual({
      canRedo: true,
      canUndo: false,
      redoLabel: 'trade.create',
      undoLabel: null,
    });
  });

  it('keeps a failed redo retryable and out of the undo stack', () => {
    const execute = vi.fn();
    const history = new UndoRedoHistory();
    history.execute({ execute, label: 'trade.create', undo: () => undefined });
    history.undo();
    execute.mockImplementation(() => {
      throw new Error('replay failed');
    });

    expect(() => history.redo()).toThrow('replay failed');
    expect(history.getState()).toEqual({
      canRedo: true,
      canUndo: false,
      redoLabel: 'trade.create',
      undoLabel: null,
    });

    execute.mockImplementation(() => undefined);
    expect(history.redo()).toBe(true);
    expect(history.getState()).toEqual({
      canRedo: false,
      canUndo: true,
      redoLabel: null,
      undoLabel: 'trade.create',
    });
  });

  it('does not record a command whose execute failed', () => {
    const history = new UndoRedoHistory();

    expect(() =>
      history.execute({
        execute: () => {
          throw new Error('write failed');
        },
        label: 'trade.create',
        undo: () => undefined,
      }),
    ).toThrow('write failed');
    expect(history.getState().canUndo).toBe(false);
  });

  it('rolls back a partial inverse before keeping it retryable', () => {
    let records: string[] = ['created'];
    let failAfterMutation = true;
    const history = new UndoRedoHistory({
      execute: (operation) => {
        const snapshot = [...records];
        try {
          return operation();
        } catch (error) {
          records = snapshot;
          throw error;
        }
      },
    });
    history.execute({
      execute: () => {
        records = ['created'];
      },
      label: 'instrument.delete',
      undo: () => {
        records.push('restored-defaults');
        if (failAfterMutation) throw new Error('defaults restore failed');
      },
    });

    expect(() => history.undo()).toThrow('defaults restore failed');
    expect(records).toEqual(['created']);
    expect(history.getState().canUndo).toBe(true);

    failAfterMutation = false;
    expect(history.undo()).toBe(true);
    expect(records).toEqual(['created', 'restored-defaults']);
  });
});
