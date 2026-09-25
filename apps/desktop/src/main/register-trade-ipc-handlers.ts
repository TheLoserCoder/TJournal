import { ipcMain } from 'electron';

import type {
  GetTradeByIdUseCase,
  GetTradePreferencesUseCase,
  JournalTableReader,
} from '@tjournal/trade';

import { IPC_CHANNELS } from '../shared/ipc-channels';
import { journalPageRequestSchema } from '../shared/journal-page-ipc-schema';
import {
  tradeIdSchema,
  tradeIdsSchema,
  updateTradePreferencesSchema,
  createTradeSchema,
  updateTradeSchema,
} from '../shared/trade-ipc-schemas';
import type { TradePreferencesCommands } from './application/trade-preferences/trade-preferences-commands';
import type { TradeCommands } from './application/trades/trade-commands';
import { asResult } from './ipc-result';
import type { IpcRegistrationContext } from './ipc-registration-context';
import { toJournalPageDto, toJournalTableQuery } from './journal-page-mapper';
import { parseIpcInput } from './parse-ipc-input';

export interface TradeIpcDependencies {
  readonly commands: Pick<TradeCommands, 'create' | 'delete' | 'deleteMany' | 'update'>;
  readonly getTradeByIdUseCase: Pick<GetTradeByIdUseCase, 'execute'>;
  readonly getTradePreferencesUseCase: Pick<GetTradePreferencesUseCase, 'execute'>;
  readonly journalTableReader: Pick<JournalTableReader, 'readPage'>;
  readonly preferencesCommands: Pick<TradePreferencesCommands, 'update'>;
}

export const registerTradeIpcHandlers = (
  dependencies: TradeIpcDependencies,
  context: IpcRegistrationContext,
): void => {
  ipcMain.handle(IPC_CHANNELS.tradesCreate, (_event, input: unknown) =>
    asResult(
      () => {
        const parsedInput = parseIpcInput(createTradeSchema, input);
        const outcome = dependencies.commands.create(parsedInput);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.trade-create.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradesUpdate, (_event, input: unknown) =>
    asResult(
      () => {
        const parsedInput = parseIpcInput(updateTradeSchema, input);
        const outcome = dependencies.commands.update(parsedInput);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.trade-update.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradesDelete, (_event, id: unknown) =>
    asResult(
      () => {
        const parsedId = parseIpcInput(tradeIdSchema, id);
        const outcome = dependencies.commands.delete(parsedId);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.trade-delete.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradesDeleteMany, (_event, ids: unknown) =>
    asResult(
      () => {
        const parsedIds = parseIpcInput(tradeIdsSchema, ids);
        const outcome = dependencies.commands.deleteMany(parsedIds);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.trades-delete-many.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradesPage, (_event, input: unknown) =>
    asResult(
      () => {
        const request = parseIpcInput(journalPageRequestSchema, input);
        return toJournalPageDto(
          dependencies.journalTableReader.readPage(toJournalTableQuery(request)),
        );
      },
      context.logger,
      'ipc.trades-page.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradesGet, (_event, input: unknown) =>
    asResult(
      () => dependencies.getTradeByIdUseCase.execute(parseIpcInput(tradeIdSchema, input)),
      context.logger,
      'ipc.trade-get.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradePreferencesGet, () =>
    asResult(
      () => dependencies.getTradePreferencesUseCase.execute(),
      context.logger,
      'ipc.trade-preferences-get.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.tradePreferencesUpdate, (_event, input: unknown) =>
    asResult(
      () => {
        const request = parseIpcInput(updateTradePreferencesSchema, input);
        const outcome = dependencies.preferencesCommands.update({
          preferences: request.preferences,
          rebindHistorical: request.rebindHistorical,
        });
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.trade-preferences-update.failed',
    ),
  );
};
