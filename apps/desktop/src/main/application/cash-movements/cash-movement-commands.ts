import type {
  CashMovement,
  CreateCashMovementInput,
  CreateCashMovementUseCase,
  DeleteCashMovementUseCase,
  GetCashMovementByIdUseCase,
  UpdateCashMovementInput,
  UpdateCashMovementUseCase,
} from '@tjournal/account';

import { DATA_RESOURCES } from '../../../shared/desktop-api';
import type { CommandHistory } from '../command-history';
import type { CommandOutcome } from '../command-outcome';

const CASH_MOVEMENT_RESOURCES = [
  DATA_RESOURCES.history,
  DATA_RESOURCES.accounts,
  DATA_RESOURCES.cashMovements,
] as const;

/**
 * Undo/Redo orchestration for deposits and withdrawals. The movement identity
 * and timestamp survive Undo so a restored movement is the same record.
 */
export class CashMovementCommands {
  public constructor(
    private readonly history: CommandHistory,
    private readonly createCashMovementUseCase: Pick<CreateCashMovementUseCase, 'execute'>,
    private readonly updateCashMovementUseCase: Pick<UpdateCashMovementUseCase, 'execute'>,
    private readonly getCashMovementByIdUseCase: Pick<GetCashMovementByIdUseCase, 'execute'>,
    private readonly deleteCashMovementUseCase: Pick<DeleteCashMovementUseCase, 'execute'>,
  ) {}

  public create(input: CreateCashMovementInput): CommandOutcome<CashMovement> {
    let created: CashMovement | null = null;
    const value = this.history.execute({
      execute: () => {
        created = this.createCashMovementUseCase.execute(input, created?.id);
        return created;
      },
      label: 'cash-movement.create',
      undo: () => {
        if (created !== null) this.deleteCashMovementUseCase.execute(created.id);
      },
    });
    return { changedResources: CASH_MOVEMENT_RESOURCES, value };
  }

  public update(input: UpdateCashMovementInput): CommandOutcome<CashMovement> {
    const previous = this.getCashMovementByIdUseCase.execute(input.id);
    if (previous === null) throw new Error('Cash movement not found.');
    const value = this.history.execute({
      execute: () => this.updateCashMovementUseCase.execute(input),
      label: 'cash-movement.update',
      undo: () => {
        this.updateCashMovementUseCase.execute(previous);
      },
    });
    return { changedResources: CASH_MOVEMENT_RESOURCES, value };
  }

  public delete(id: string): CommandOutcome<CashMovement> {
    const previous = this.getCashMovementByIdUseCase.execute(id);
    if (previous === null) throw new Error('Cash movement not found.');
    const value = this.history.execute({
      execute: () => this.deleteCashMovementUseCase.execute(id),
      label: 'cash-movement.delete',
      undo: () => {
        this.createCashMovementUseCase.execute(
          {
            accountId: previous.accountId,
            amountUsd: previous.amountUsd,
            kind: previous.kind,
            occurredAt: previous.occurredAt,
          },
          previous.id,
        );
      },
    });
    return { changedResources: CASH_MOVEMENT_RESOURCES, value };
  }
}
