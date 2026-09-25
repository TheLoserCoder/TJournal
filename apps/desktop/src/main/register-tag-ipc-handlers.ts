import { ipcMain } from 'electron';

import type { GetTagTradeCountsUseCase, ListTagsUseCase } from '@tjournal/tag';

import { IPC_CHANNELS } from '../shared/ipc-channels';
import { createTagSchema, tagIdsSchema, updateTagSchema } from '../shared/tag-ipc-schemas';
import type { TagCommands } from './application/tags/tag-commands';
import { asResult } from './ipc-result';
import type { IpcRegistrationContext } from './ipc-registration-context';
import { parseIpcInput } from './parse-ipc-input';

export interface TagIpcDependencies {
  readonly commands: Pick<TagCommands, 'create' | 'deleteMany' | 'update'>;
  readonly getTagTradeCountsUseCase: Pick<GetTagTradeCountsUseCase, 'execute'>;
  readonly listTagsUseCase: Pick<ListTagsUseCase, 'execute'>;
}

export const registerTagIpcHandlers = (
  dependencies: TagIpcDependencies,
  context: IpcRegistrationContext,
): void => {
  ipcMain.handle(IPC_CHANNELS.tagsList, () =>
    asResult(() => dependencies.listTagsUseCase.execute(), context.logger, 'ipc.tags-list.failed'),
  );

  ipcMain.handle(IPC_CHANNELS.tagsCounts, () =>
    asResult(
      () => dependencies.getTagTradeCountsUseCase.execute(),
      context.logger,
      'ipc.tags-counts.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tagsCreate, (_event, input: unknown) =>
    asResult(
      () => {
        const parsedInput = parseIpcInput(createTagSchema, input);
        const outcome = dependencies.commands.create(parsedInput);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.tag-create.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tagsUpdate, (_event, input: unknown) =>
    asResult(
      () => {
        const parsedInput = parseIpcInput(updateTagSchema, input);
        const outcome = dependencies.commands.update(parsedInput);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.tag-update.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tagsDeleteMany, (_event, ids: unknown) =>
    asResult(
      () => {
        const parsedIds = parseIpcInput(tagIdsSchema, ids);
        const outcome = dependencies.commands.deleteMany(parsedIds);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.tags-delete-many.failed',
    ),
  );
};
