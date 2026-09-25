/**
 * Executes a synchronous group of persistence operations as one atomic unit.
 * The consuming application layer owns the port; the database layer provides
 * the transactional implementation.
 */
export interface TradeUnitOfWork {
  execute<T>(operation: () => T): T;
}
