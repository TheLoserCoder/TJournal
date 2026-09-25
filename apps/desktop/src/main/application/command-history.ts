/**
 * Inward-owned port for session Undo/Redo. Application commands describe a
 * reversible mutation; the outer `UndoRedoHistory` adapter stores and replays
 * it. Commands never import the adapter.
 */
export interface UndoableCommand<T> {
  execute(): T;
  label: string;
  undo(): void;
}

export interface CommandHistory {
  execute<T>(command: UndoableCommand<T>): T;
}
