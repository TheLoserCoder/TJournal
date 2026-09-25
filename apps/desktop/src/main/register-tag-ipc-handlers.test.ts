import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ipcMainMock } = vi.hoisted(() => ({ ipcMainMock: { handle: vi.fn() } }));
vi.mock('electron', () => ({ ipcMain: ipcMainMock }));

import type { IpcResult, TagDto } from '../shared/desktop-api';
import { DATA_RESOURCES } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { registerTagIpcHandlers } from './register-tag-ipc-handlers';
import { createIpcTestHarness } from './testing/ipc-test-harness';

const TAG: TagDto = {
  color: 'blue',
  createdAt: '2026-01-01T00:00:00.000Z',
  description: '',
  id: 'tag-1',
  name: 'Breakout',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const createDependencies = () => ({
  commands: {
    create: vi.fn(() => ({
      changedResources: [DATA_RESOURCES.history, DATA_RESOURCES.tags, DATA_RESOURCES.tradeTags],
      value: TAG,
    })),
    deleteMany: vi.fn(() => ({
      changedResources: [DATA_RESOURCES.history, DATA_RESOURCES.tags, DATA_RESOURCES.tradeTags],
      value: [TAG],
    })),
    update: vi.fn(() => ({
      changedResources: [DATA_RESOURCES.history, DATA_RESOURCES.tags],
      value: TAG,
    })),
  },
  getTagTradeCountsUseCase: { execute: vi.fn(() => ({ 'tag-1': 3 })) },
  listTagsUseCase: { execute: vi.fn(() => [TAG]) },
});

describe('registerTagIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers exactly the documented tag channels', () => {
    const harness = createIpcTestHarness();
    registerTagIpcHandlers(createDependencies(), harness.context);

    expect([...harness.registeredChannels()].sort()).toEqual(
      [
        IPC_CHANNELS.tagsCounts,
        IPC_CHANNELS.tagsCreate,
        IPC_CHANNELS.tagsDeleteMany,
        IPC_CHANNELS.tagsList,
        IPC_CHANNELS.tagsUpdate,
      ].sort(),
    );
  });

  it('parses a create payload, delegates to the command and publishes its resources', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerTagIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<TagDto>>(IPC_CHANNELS.tagsCreate, {
      name: 'Breakout',
    });

    expect(dependencies.commands.create).toHaveBeenCalledWith({ name: 'Breakout' });
    expect(result).toEqual({ ok: true, value: TAG });
    expect(harness.capture).toHaveBeenCalledWith([
      DATA_RESOURCES.history,
      DATA_RESOURCES.tags,
      DATA_RESOURCES.tradeTags,
    ]);
  });

  it('never invokes a command for an invalid payload', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerTagIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<TagDto>>(IPC_CHANNELS.tagsCreate, { name: '' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a validation failure.');
    expect(result.error.code).toBe('validation-invalid');
    expect(dependencies.commands.create).not.toHaveBeenCalled();
    expect(harness.capture).not.toHaveBeenCalled();
  });

  it('does not publish changes when the command fails', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    dependencies.commands.update.mockImplementation(() => {
      throw new Error('write failed');
    });
    registerTagIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<TagDto>>(IPC_CHANNELS.tagsUpdate, {
      color: 'blue',
      description: '',
      id: 'tag-1',
      name: 'Breakout',
    });

    expect(result.ok).toBe(false);
    expect(harness.capture).not.toHaveBeenCalled();
    expect(harness.logger.error).toHaveBeenCalledWith(
      'ipc.tag-update.failed',
      expect.objectContaining({ code: 'unexpected' }),
    );
  });
});
