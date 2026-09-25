import { ipcMain } from 'electron';

import type {
  ListAccountDefaultsUseCase,
  ListAccountsUseCase,
  ListCashMovementsUseCase,
} from '@tjournal/account';

import { IPC_CHANNELS } from '../shared/ipc-channels';
import {
  accountIdSchema,
  cashMovementSchema,
  createAccountSchema,
  tradeIdSchema as cashMovementIdSchema,
  updateAccountSchema,
  updateCashMovementSchema,
} from '../shared/trade-ipc-schemas';
import type { AccountCommands } from './application/accounts/account-commands';
import type { CashMovementCommands } from './application/cash-movements/cash-movement-commands';
import { asResult } from './ipc-result';
import type { IpcRegistrationContext } from './ipc-registration-context';
import { parseIpcInput } from './parse-ipc-input';

export interface AccountIpcDependencies {
  readonly accountCommands: Pick<AccountCommands, 'create' | 'delete' | 'restore' | 'update'>;
  readonly cashMovementCommands: Pick<CashMovementCommands, 'create' | 'delete' | 'update'>;
  readonly listAccountDefaultsUseCase: Pick<ListAccountDefaultsUseCase, 'execute'>;
  readonly listAccountsUseCase: Pick<ListAccountsUseCase, 'execute'>;
  readonly listCashMovementsUseCase: Pick<ListCashMovementsUseCase, 'execute'>;
}

export const registerAccountIpcHandlers = (
  dependencies: AccountIpcDependencies,
  context: IpcRegistrationContext,
): void => {
  ipcMain.handle(IPC_CHANNELS.accountsList, () =>
    asResult(
      () => dependencies.listAccountsUseCase.execute(),
      context.logger,
      'ipc.accounts-list.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.accountsDefaults, (_event, id: unknown) =>
    asResult(
      () => dependencies.listAccountDefaultsUseCase.execute(parseIpcInput(accountIdSchema, id)),
      context.logger,
      'ipc.accounts-defaults.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.accountsCreate, (_event, input: unknown) =>
    asResult(
      () => {
        const parsed = parseIpcInput(createAccountSchema, input);
        const outcome = dependencies.accountCommands.create(parsed);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.account-create.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.accountsUpdate, (_event, input: unknown) =>
    asResult(
      () => {
        const parsed = parseIpcInput(updateAccountSchema, input);
        const outcome = dependencies.accountCommands.update(parsed);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.account-update.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.accountsDelete, (_event, id: unknown) =>
    asResult(
      () => {
        const parsed = parseIpcInput(accountIdSchema, id);
        const outcome = dependencies.accountCommands.delete(parsed);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.account-delete.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.accountsRestore, (_event, id: unknown) =>
    asResult(
      () => {
        const parsed = parseIpcInput(accountIdSchema, id);
        const outcome = dependencies.accountCommands.restore(parsed);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.account-restore.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.cashMovementsList, () =>
    asResult(
      () => dependencies.listCashMovementsUseCase.execute(),
      context.logger,
      'ipc.cash-movements-list.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.cashMovementsCreate, (_event, input: unknown) =>
    asResult(
      () => {
        const parsed = parseIpcInput(cashMovementSchema, input);
        const outcome = dependencies.cashMovementCommands.create(parsed);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.cash-movement-create.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.cashMovementsUpdate, (_event, input: unknown) =>
    asResult(
      () => {
        const parsed = parseIpcInput(updateCashMovementSchema, input);
        const outcome = dependencies.cashMovementCommands.update(parsed);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.cash-movement-update.failed',
    ),
  );

  ipcMain.handle(IPC_CHANNELS.cashMovementsDelete, (_event, id: unknown) =>
    asResult(
      () => {
        const parsed = parseIpcInput(cashMovementIdSchema, id);
        const outcome = dependencies.cashMovementCommands.delete(parsed);
        context.capture(outcome.changedResources);
        return outcome.value;
      },
      context.logger,
      'ipc.cash-movement-delete.failed',
    ),
  );
};
