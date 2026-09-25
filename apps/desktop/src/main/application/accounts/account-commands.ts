import type {
  ArchiveAccountUseCase,
  CreateAccountUseCase,
  CreateTradingAccountInput,
  DeleteAccountUseCase,
  GetAccountByIdUseCase,
  ListAccountDefaultsUseCase,
  ListAccountsUseCase,
  RestoreAccountSnapshotUseCase,
  RestoreAccountUseCase,
  TradingAccount,
  UpdateAccountUseCase,
  UpdateTradingAccountInput,
} from '@tjournal/account';

import { DATA_RESOURCES } from '../../../shared/desktop-api';
import type { CommandHistory } from '../command-history';
import type { CommandOutcome } from '../command-outcome';

const ACCOUNT_RESOURCES = [
  DATA_RESOURCES.history,
  DATA_RESOURCES.accounts,
  DATA_RESOURCES.accountInstrumentDefaults,
] as const;
const ACCOUNT_RESTORE_RESOURCES = [DATA_RESOURCES.history, DATA_RESOURCES.accounts] as const;

/**
 * Undo/Redo orchestration for trading accounts. Archive and physical delete
 * have different inverses: an archived account is unarchived, a deleted one is
 * restored together with its entry-time defaults snapshot.
 */
export class AccountCommands {
  public constructor(
    private readonly history: CommandHistory,
    private readonly createAccountUseCase: Pick<CreateAccountUseCase, 'execute'>,
    private readonly updateAccountUseCase: Pick<UpdateAccountUseCase, 'execute'>,
    private readonly getAccountByIdUseCase: Pick<GetAccountByIdUseCase, 'execute'>,
    private readonly deleteAccountUseCase: Pick<DeleteAccountUseCase, 'execute'>,
    private readonly restoreAccountUseCase: Pick<RestoreAccountUseCase, 'execute'>,
    private readonly archiveAccountUseCase: Pick<ArchiveAccountUseCase, 'execute'>,
    private readonly listAccountsUseCase: Pick<ListAccountsUseCase, 'execute'>,
    private readonly listAccountDefaultsUseCase: Pick<ListAccountDefaultsUseCase, 'execute'>,
    private readonly restoreAccountSnapshotUseCase: Pick<RestoreAccountSnapshotUseCase, 'execute'>,
  ) {}

  public create(input: CreateTradingAccountInput): CommandOutcome<TradingAccount> {
    let created: TradingAccount | null = null;
    const value = this.history.execute({
      execute: () => {
        created = this.createAccountUseCase.execute(input);
        return (
          this.listAccountsUseCase.execute().find((item) => item.id === created?.id) ?? created
        );
      },
      label: 'account.create',
      undo: () => {
        if (created !== null) this.deleteAccountUseCase.execute(created.id);
      },
    });
    return { changedResources: ACCOUNT_RESOURCES, value };
  }

  public update(input: UpdateTradingAccountInput): CommandOutcome<TradingAccount | undefined> {
    const previous = this.getAccountByIdUseCase.execute(input.id);
    if (previous === null) throw new Error('Account not found.');
    const previousDefaults = this.listAccountDefaultsUseCase.execute(input.id);
    const value = this.history.execute({
      execute: () => {
        this.updateAccountUseCase.execute(input);
        return this.listAccountsUseCase.execute().find((item) => item.id === input.id);
      },
      label: 'account.update',
      undo: () => {
        this.restoreAccountSnapshotUseCase.execute(previous, previousDefaults);
      },
    });
    return { changedResources: ACCOUNT_RESOURCES, value };
  }

  public delete(id: string): CommandOutcome<TradingAccount> {
    const previous = this.getAccountByIdUseCase.execute(id);
    if (previous === null) throw new Error('Account not found.');
    const defaults = this.listAccountDefaultsUseCase.execute(id);
    let wasArchived = false;
    const value = this.history.execute({
      execute: () => {
        this.deleteAccountUseCase.execute(id);
        wasArchived = this.listAccountsUseCase.execute().some((item) => item.id === id);
        return previous;
      },
      label: 'account.delete',
      undo: () => {
        if (wasArchived) {
          this.restoreAccountUseCase.execute(id);
          return;
        }
        this.restoreAccountSnapshotUseCase.execute(previous, defaults);
      },
    });
    return { changedResources: ACCOUNT_RESOURCES, value };
  }

  public restore(id: string): CommandOutcome<TradingAccount> {
    const value = this.history.execute({
      execute: () => this.restoreAccountUseCase.execute(id),
      label: 'account.restore',
      undo: () => {
        this.archiveAccountUseCase.execute(id);
      },
    });
    return { changedResources: ACCOUNT_RESTORE_RESOURCES, value };
  }
}
