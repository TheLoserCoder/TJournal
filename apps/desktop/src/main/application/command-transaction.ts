/**
 * Atomic boundary for an Undo/Redo command. The application layer owns the
 * port; the active vault adapter supplies the transaction implementation.
 */
export interface CommandTransaction {
  execute<T>(operation: () => T): T;
}
