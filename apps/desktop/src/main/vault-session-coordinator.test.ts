import { describe, expect, it, vi } from 'vitest';

import type { VaultDescriptor } from '@tjournal/journal';
import { AppError } from '@tjournal/platform-errors';

import type { CommittedDataChangeDto } from '../shared/desktop-api';
import { UndoRedoHistory } from './history/undo-redo-history';
import { VaultSessionCoordinator } from './vault-session-coordinator';

const descriptor = (vaultPath: string): VaultDescriptor => ({
  createdAt: '2026-09-21T00:00:00.000Z',
  formatVersion: 1,
  path: vaultPath,
  vaultId: `vault-${vaultPath}`,
});

const CHANGE: CommittedDataChangeDto = {
  changeId: 'change-1',
  resources: [],
  revisions: {},
  vaultGeneration: 'generation-1',
};

const createHarness = (
  overrides: {
    readonly inspect?: (vaultPath: string) => VaultDescriptor;
  } = {},
) => {
  const history = new UndoRedoHistory();
  history.execute({ execute: () => undefined, label: 'seed', undo: () => undefined });
  const createVaultUseCase = {
    execute: vi.fn((vaultPath: string) => descriptor(vaultPath)),
  };
  const openVaultUseCase = {
    execute: vi.fn(async (vaultPath: string) => descriptor(vaultPath)),
  };
  const inspectVaultUseCase = {
    execute: vi.fn(overrides.inspect ?? ((vaultPath: string) => descriptor(vaultPath))),
  };
  const setLastVaultPath = vi.fn();
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
  const coordinator = new VaultSessionCoordinator(
    createVaultUseCase,
    openVaultUseCase,
    inspectVaultUseCase,
    { resetForVault: () => CHANGE },
    { setLastVaultPath },
    history,
    logger,
  );
  return {
    coordinator,
    createVaultUseCase,
    history,
    inspectVaultUseCase,
    logger,
    openVaultUseCase,
    setLastVaultPath,
  };
};

describe('VaultSessionCoordinator', () => {
  it('validates a candidate before replacing the active vault and clears stale history', async () => {
    const { coordinator, history, inspectVaultUseCase, openVaultUseCase, setLastVaultPath } =
      createHarness();

    const activation = await coordinator.open('C:/vault-b');

    expect(inspectVaultUseCase.execute).toHaveBeenCalledWith('C:/vault-b');
    expect(openVaultUseCase.execute).toHaveBeenCalledWith('C:/vault-b');
    const inspectOrder = inspectVaultUseCase.execute.mock.invocationCallOrder[0];
    const openOrder = openVaultUseCase.execute.mock.invocationCallOrder[0];
    if (inspectOrder === undefined || openOrder === undefined) {
      throw new Error('Expected both vault use cases to be called.');
    }
    expect(inspectOrder).toBeLessThan(openOrder);
    expect(activation).toEqual({ change: CHANGE, path: 'C:/vault-b' });
    expect(history.getState()).toEqual({
      canRedo: false,
      canUndo: false,
      redoLabel: null,
      undoLabel: null,
    });
    expect(setLastVaultPath).toHaveBeenCalledWith('C:/vault-b');
  });

  it('keeps the active vault and its history when a candidate fails inspection', async () => {
    const failure = new AppError({ code: 'vault-invalid', message: 'Candidate is broken.' });
    const { coordinator, history, openVaultUseCase, setLastVaultPath } = createHarness({
      inspect: () => {
        throw failure;
      },
    });
    history.execute({ execute: () => undefined, label: 'trade.create', undo: () => undefined });

    await expect(coordinator.open('C:/broken')).rejects.toThrow('Candidate is broken.');
    expect(openVaultUseCase.execute).not.toHaveBeenCalled();
    expect(setLastVaultPath).not.toHaveBeenCalled();
    expect(history.getState().canUndo).toBe(true);
  });

  it('starts a fresh history session when a vault is created', () => {
    const { coordinator, createVaultUseCase, history, inspectVaultUseCase } = createHarness();

    coordinator.create('C:/new-vault');

    expect(createVaultUseCase.execute).toHaveBeenCalledWith('C:/new-vault');
    expect(inspectVaultUseCase.execute).not.toHaveBeenCalled();
    expect(history.getState().canUndo).toBe(false);
    expect(history.getState().canRedo).toBe(false);
  });

  it('keeps an activated vault successful when the recent-path preference cannot be saved', async () => {
    const { coordinator, history, logger, setLastVaultPath } = createHarness();
    setLastVaultPath.mockImplementation(() => {
      throw new Error('preferences are read-only');
    });

    await expect(coordinator.open('C:/vault-b')).resolves.toEqual({
      change: CHANGE,
      path: 'C:/vault-b',
    });

    expect(history.getState().canUndo).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith('vault.recent-path-save-failed');
  });

  it('rejects another activation while a pre-migration backup is pending', async () => {
    const { coordinator, openVaultUseCase, createVaultUseCase } = createHarness();
    let complete: ((value: VaultDescriptor) => void) | undefined;
    openVaultUseCase.execute.mockImplementationOnce(
      () =>
        new Promise<VaultDescriptor>((resolve) => {
          complete = resolve;
        }),
    );
    const pending = coordinator.open('C:/vault-b');
    await expect(coordinator.open('C:/vault-c')).rejects.toMatchObject({ retryable: true });
    expect(() => coordinator.create('C:/vault-c')).toThrow();
    expect(createVaultUseCase.execute).not.toHaveBeenCalled();
    complete?.(descriptor('C:/vault-b'));
    await expect(pending).resolves.toMatchObject({ path: 'C:/vault-b' });
    await expect(coordinator.open('C:/vault-c')).resolves.toMatchObject({ path: 'C:/vault-c' });
  });
});
