import type { CommandHistory, UndoableCommand } from '../application/command-history';
import type { CommandTransaction } from '../application/command-transaction';

const directCommandTransaction: CommandTransaction = {
  execute: <T>(operation: () => T): T => operation(),
};

export interface HistoryState {
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  readonly redoLabel: string | null;
  readonly undoLabel: string | null;
}

export class UndoRedoHistory implements CommandHistory {
  private readonly redoStack: UndoableCommand<unknown>[] = [];
  private readonly undoStack: UndoableCommand<unknown>[] = [];

  public constructor(
    private readonly commandTransaction: CommandTransaction = directCommandTransaction,
  ) {}

  public execute<T>(command: UndoableCommand<T>): T {
    const result = this.commandTransaction.execute(command.execute);
    this.undoStack.push(command);
    this.redoStack.length = 0;
    return result;
  }

  public getState(): HistoryState {
    const undoCommand = this.undoStack.at(-1);
    const redoCommand = this.redoStack.at(-1);
    return {
      canRedo: redoCommand !== undefined,
      canUndo: undoCommand !== undefined,
      redoLabel: redoCommand?.label ?? null,
      undoLabel: undoCommand?.label ?? null,
    };
  }

  public redo(): boolean {
    const command = this.redoStack.at(-1);
    if (command === undefined) return false;
    // Apply before moving the command: a failed replay stays available on the
    // redo stack instead of being reported as a successful undo.
    this.commandTransaction.execute(command.execute);
    this.redoStack.pop();
    this.undoStack.push(command);
    return true;
  }

  /** Drops every command so a session cannot replay work from another vault. */
  public reset(): void {
    this.redoStack.length = 0;
    this.undoStack.length = 0;
  }

  public undo(): boolean {
    const command = this.undoStack.at(-1);
    if (command === undefined) return false;
    // Apply before moving the command: a failed inverse must not enter the
    // redo stack and must remain retryable.
    this.commandTransaction.execute(command.undo);
    this.undoStack.pop();
    this.redoStack.push(command);
    return true;
  }
}
