import { ipcMain } from 'electron';

import type {
  GetInstrumentProfileUseCase,
  ListInstrumentsUseCase,
  SaveInstrumentProfileUseCase,
} from '@tjournal/instrument';

import { DATA_RESOURCES } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import {
  createInstrumentSchema,
  instrumentIdSchema,
  instrumentProfileSchema,
  updateInstrumentSchema,
} from '../shared/trade-ipc-schemas';
import type { InstrumentCommands } from './application/instruments/instrument-commands';
import { asResult } from './ipc-result';
import type { IpcRegistrationContext } from './ipc-registration-context';
import { parseIpcInput } from './parse-ipc-input';

export interface InstrumentIpcDependencies {
  readonly commands: Pick<InstrumentCommands, 'create' | 'delete' | 'restore' | 'update'>;
  readonly getInstrumentProfileUseCase: Pick<GetInstrumentProfileUseCase, 'execute'>;
  readonly listInstrumentsUseCase: Pick<ListInstrumentsUseCase, 'execute'>;
  readonly saveInstrumentProfileUseCase: Pick<SaveInstrumentProfileUseCase, 'execute'>;
}

export const registerInstrumentIpcHandlers = (
  dependencies: InstrumentIpcDependencies,
  context: IpcRegistrationContext,
): void => {
  ipcMain.handle(IPC_CHANNELS.instrumentsList, () =>
    asResult(
      () => dependencies.listInstrumentsUseCase.execute(),
      context.logger,
      'ipc.instruments-list.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.instrumentsCreate, (_event, input: unknown) =>
    asResult(
      () => {
        const parsed = parseIpcInput(createInstrumentSchema, input);
        const outcome = dependencies.commands.create(parsed);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.instrument-create.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.instrumentsUpdate, (_event, input: unknown) =>
    asResult(
      () => {
        const parsed = parseIpcInput(updateInstrumentSchema, input);
        const outcome = dependencies.commands.update(parsed);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.instrument-update.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.instrumentsDelete, (_event, id: unknown) =>
    asResult(
      () => {
        const parsed = parseIpcInput(instrumentIdSchema, id);
        const outcome = dependencies.commands.delete(parsed);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.instrument-delete.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.instrumentsRestore, (_event, id: unknown) =>
    asResult(
      () => {
        const parsed = parseIpcInput(instrumentIdSchema, id);
        const outcome = dependencies.commands.restore(parsed);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.instrument-restore.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.instrumentProfilesGet, (_event, instrumentId: unknown) =>
    asResult(
      () =>
        dependencies.getInstrumentProfileUseCase.execute(
          parseIpcInput(instrumentIdSchema, instrumentId),
        ),
      context.logger,
      'ipc.instrument-profile-get.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.instrumentProfilesUpdate, (_event, input: unknown) =>
    asResult(
      () => {
        const result = dependencies.saveInstrumentProfileUseCase.execute(
          parseIpcInput(instrumentProfileSchema, input),
        );
        context.capture([DATA_RESOURCES.instrumentProfiles]);
        return result;
      },
      context.logger,
      'ipc.instrument-profile-update.failed',
    ),
  );
};
