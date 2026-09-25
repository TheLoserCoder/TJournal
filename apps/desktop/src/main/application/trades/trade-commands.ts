import type {
  ClosedTrade,
  CreateClosedTradeInput,
  CreateTradeUseCase,
  DeleteTradeUseCase,
  DeleteTradesUseCase,
  GetTradeByIdUseCase,
  RestoreTradeUseCase,
  RestoreTradesUseCase,
  UpdateTradeUseCase,
} from '@tjournal/trade';

import { DATA_RESOURCES } from '../../../shared/desktop-api';
import type { CommandHistory } from '../command-history';
import type { CommandOutcome } from '../command-outcome';

const TRADE_RESOURCES = [DATA_RESOURCES.history, DATA_RESOURCES.trades] as const;
const TRADE_HISTORY_RESOURCES = [DATA_RESOURCES.history] as const;

/**
 * Undo/Redo orchestration for trades. Delete captures the whole aggregate
 * before removing it, so Undo restores the same financial snapshots.
 */
export class TradeCommands {
  public constructor(
    private readonly history: CommandHistory,
    private readonly createTradeUseCase: Pick<CreateTradeUseCase, 'execute'>,
    private readonly updateTradeUseCase: Pick<UpdateTradeUseCase, 'execute'>,
    private readonly getTradeByIdUseCase: Pick<GetTradeByIdUseCase, 'execute'>,
    private readonly deleteTradeUseCase: Pick<DeleteTradeUseCase, 'execute'>,
    private readonly deleteTradesUseCase: Pick<DeleteTradesUseCase, 'execute'>,
    private readonly restoreTradeUseCase: Pick<RestoreTradeUseCase, 'execute'>,
    private readonly restoreTradesUseCase: Pick<RestoreTradesUseCase, 'execute'>,
  ) {}

  public create(input: CreateClosedTradeInput): CommandOutcome<ClosedTrade> {
    let created: ClosedTrade | null = null;
    const value = this.history.execute({
      execute: () => {
        created = this.createTradeUseCase.execute(input, created?.id);
        return created;
      },
      label: 'trade.create',
      undo: () => {
        if (created !== null) this.deleteTradeUseCase.execute(created.id);
      },
    });
    return { changedResources: TRADE_RESOURCES, value };
  }

  public update(input: ClosedTrade): CommandOutcome<ClosedTrade> {
    const previous = this.getTradeByIdUseCase.execute(input.id);
    if (previous === null) throw new Error('Trade not found.');
    const value = this.history.execute({
      execute: () => this.updateTradeUseCase.execute(input),
      label: 'trade.update',
      undo: () => {
        this.restoreTradeUseCase.execute(previous);
      },
    });
    return { changedResources: TRADE_RESOURCES, value };
  }

  public delete(id: string): CommandOutcome<ClosedTrade> {
    const previous = this.getTradeByIdUseCase.execute(id);
    if (previous === null) throw new Error('Trade not found.');
    const value = this.history.execute({
      execute: () => this.deleteTradeUseCase.execute(id),
      label: 'trade.delete',
      undo: () => {
        this.restoreTradesUseCase.execute([previous]);
      },
    });
    return { changedResources: TRADE_HISTORY_RESOURCES, value };
  }

  public deleteMany(ids: readonly string[]): CommandOutcome<readonly ClosedTrade[]> {
    let deleted: readonly ClosedTrade[] = [];
    const value = this.history.execute({
      execute: () => {
        deleted = this.deleteTradesUseCase.execute(ids);
        return deleted;
      },
      label: 'trade.delete-many',
      undo: () => {
        this.restoreTradesUseCase.execute(deleted);
      },
    });
    return { changedResources: TRADE_HISTORY_RESOURCES, value };
  }
}
