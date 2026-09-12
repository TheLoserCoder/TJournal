export interface UndoableCommand<T> {
  execute(): T;
  label: string;
  undo(): void;
}

export interface HistoryState {
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  readonly redoLabel: string | null;
  readonly undoLabel: string | null;
}

export class UndoRedoHistory {
  private readonly redoStack: UndoableCommand<unknown>[] = [];
  private readonly undoStack: UndoableCommand<unknown>[] = [];

  public execute<T>(command: UndoableCommand<T>): T {
    const result = command.execute();
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

  public redo(): void {
    const command = this.redoStack.pop();
    if (command === undefined) return;
    command.execute();
    this.undoStack.push(command);
  }

  public undo(): void {
    const command = this.undoStack.pop();
    if (command === undefined) return;
    command.undo();
    this.redoStack.push(command);
  }
}
