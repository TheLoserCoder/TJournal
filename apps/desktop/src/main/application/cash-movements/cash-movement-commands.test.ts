import { describe, expect, it, vi } from 'vitest';

import type {
  CashMovement,
  CreateCashMovementInput,
  UpdateCashMovementInput,
} from '@tjournal/account';

import { DATA_RESOURCES } from '../../../shared/desktop-api';
import { UndoRedoHistory } from '../../history/undo-redo-history';
import { CashMovementCommands } from './cash-movement-commands';

const makeMovement = (overrides: Partial<CashMovement> = {}): CashMovement => ({
  accountId: 'account-1',
  accountName: 'Main',
  amountUsd: '500',
  id: 'movement-1',
  kind: 'deposit',
  occurredAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const createHarness = () => {
  const history = new UndoRedoHistory();
  const createCashMovementUseCase = {
    execute: vi.fn((input: CreateCashMovementInput, id = 'movement-created'): CashMovement =>
      makeMovement({ ...input, id }),
    ),
  };
  const updateCashMovementUseCase = {
    execute: vi.fn((input: UpdateCashMovementInput): CashMovement => makeMovement(input)),
  };
  const getCashMovementByIdUseCase = {
    execute: vi.fn((id: string): CashMovement | null =>
      id === 'movement-1' ? makeMovement() : null,
    ),
  };
  const deleteCashMovementUseCase = {
    execute: vi.fn((id: string): CashMovement => makeMovement({ id })),
  };
  const commands = new CashMovementCommands(
    history,
    createCashMovementUseCase,
    updateCashMovementUseCase,
    getCashMovementByIdUseCase,
    deleteCashMovementUseCase,
  );
  return {
    commands,
    createCashMovementUseCase,
    deleteCashMovementUseCase,
    getCashMovementByIdUseCase,
    history,
    updateCashMovementUseCase,
  };
};

describe('CashMovementCommands', () => {
  it('creates a movement and undoes it by deleting the same id', () => {
    const { commands, createCashMovementUseCase, deleteCashMovementUseCase, history } =
      createHarness();

    const outcome = commands.create({
      accountId: 'account-1',
      amountUsd: '500',
      kind: 'deposit',
      occurredAt: '2026-01-01T00:00:00.000Z',
    });

    expect(outcome.value.id).toBe('movement-created');
    expect(outcome.changedResources).toEqual([
      DATA_RESOURCES.history,
      DATA_RESOURCES.accounts,
      DATA_RESOURCES.cashMovements,
    ]);
    expect(createCashMovementUseCase.execute).toHaveBeenCalledWith(
      {
        accountId: 'account-1',
        amountUsd: '500',
        kind: 'deposit',
        occurredAt: '2026-01-01T00:00:00.000Z',
      },
      undefined,
    );

    history.undo();
    expect(deleteCashMovementUseCase.execute).toHaveBeenCalledWith('movement-created');
  });

  it('recreates a movement with its original identity on redo', () => {
    const { commands, createCashMovementUseCase, history } = createHarness();

    commands.create({
      accountId: 'account-1',
      amountUsd: '500',
      kind: 'deposit',
      occurredAt: '2026-01-01T00:00:00.000Z',
    });
    history.undo();
    history.redo();

    expect(createCashMovementUseCase.execute).toHaveBeenCalledTimes(2);
    expect(createCashMovementUseCase.execute.mock.calls[1]?.[1]).toBe('movement-created');
  });

  it('reads the previous movement by point lookup and restores it on undo', () => {
    const { commands, getCashMovementByIdUseCase, history, updateCashMovementUseCase } =
      createHarness();
    const input: UpdateCashMovementInput = {
      accountId: 'account-2',
      amountUsd: '250',
      id: 'movement-1',
      kind: 'withdrawal',
      occurredAt: '2026-02-01T00:00:00.000Z',
    };

    commands.update(input);

    expect(getCashMovementByIdUseCase.execute).toHaveBeenCalledWith('movement-1');
    expect(updateCashMovementUseCase.execute).toHaveBeenCalledWith(input);

    history.undo();
    expect(updateCashMovementUseCase.execute).toHaveBeenCalledWith(makeMovement());
  });

  it('refuses to update an unknown movement without touching history', () => {
    const { commands, history, updateCashMovementUseCase } = createHarness();

    expect(() =>
      commands.update({
        accountId: 'account-1',
        amountUsd: '10',
        id: 'missing',
        kind: 'deposit',
        occurredAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow('Cash movement not found.');
    expect(updateCashMovementUseCase.execute).not.toHaveBeenCalled();
    expect(history.getState().canUndo).toBe(false);
  });

  it('restores a deleted movement with the same id and timestamp on undo', () => {
    const { commands, createCashMovementUseCase, history } = createHarness();

    commands.delete('movement-1');
    history.undo();

    expect(createCashMovementUseCase.execute).toHaveBeenCalledWith(
      {
        accountId: 'account-1',
        amountUsd: '500',
        kind: 'deposit',
        occurredAt: '2026-01-01T00:00:00.000Z',
      },
      'movement-1',
    );
  });
});
