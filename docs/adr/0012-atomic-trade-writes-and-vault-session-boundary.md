# ADR-0012: Atomic trade writes and the vault session boundary

## Status

Accepted.

## Context

Two integration defects showed that cross-store writes and vault activation had no explicit boundary:

- Creating or updating an R trade persists the trade and then the remembered account `defaultRiskUsd`. Each store method owned its own transaction, so a failure in the second write left a committed trade without history and without an invalidation event.
- A successful vault switch reset revisions but not the Undo/Redo stacks, so a command recorded in the previous vault could execute against the new database.
- Opening a candidate vault migrated it on the active session connection, so a failing candidate closed the currently open vault before the error was reported.

ADR-0007 requires an explicit, atomic rule for account-bound writes; ADR-0005 requires invalidation to describe committed data only.

## Decision

- `modules/trade` owns a `TradeUnitOfWork` port with `execute<T>(operation: () => T): T`.
- `platform/database` implements it with `SqliteTradeUnitOfWork` over the shared vault connection.
- `SqliteVaultDatabase.transaction` supports nesting through SQLite savepoints: the outermost call owns `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`, inner calls use `SAVEPOINT`/`RELEASE`/`ROLLBACK TO`. Transaction depth resets when the connection closes.
- Transaction depth is restored to its exact entry value before finalization and rollback, including a failing `COMMIT` or `RELEASE`. A replacement SQLite connection is opened and configured before the active connection is closed.
- `CreateTradeUseCase` and `UpdateTradeUseCase` persist the trade and the remembered account risk inside one unit of work. A successful response means both committed; history and change publication happen only after the unit commits.
- `VaultSessionCoordinator` performs vault activation as one session transition: candidate inspection, candidate migration on a throwaway connection, revision reset, history reset, and last-path persistence. A cancelled picker or failing candidate leaves the active vault and its history untouched.
- Failure to persist the non-critical recent-vault preference is logged but does not turn an already activated database session into a failed IPC response.
- `UndoRedoHistory.reset()` clears both stacks.
- `resolveResultInput` decides whether an update is a financial edit by comparing the incoming result with the persisted trade instead of comparing the incoming payload with itself. Metadata edits keep the saved conversion; explicit result edits rebind the authoritative USD result.

## Consequences

- The IPC layer no longer orchestrates vault activation; it parses input, calls the coordinator, logs, and publishes the committed change.
- Partial trade commits can no longer produce trades without their remembered risk or invalidation.
- `UpdateTradeUseCase` still loads the persisted trade to detect changes. Plan 03 replaces that `listTrades().find(...)` with a point lookup.
- SQLite remains the single source of truth; the unit of work does not buffer writes in memory.
- Backups and multi-vault copies keep working because only session state (history, revisions) is reset, never vault data.

## Alternatives considered

- Best-effort risk write with a warning — rejected: a successful save would no longer mean the account risk is current.
- Wrapping the two writes in the IPC handler — rejected: it keeps orchestration in the transport layer and bypasses the application boundary.
- Persisting risk first — rejected: the same partial-commit class of defect, with the failure moved.
- Clearing history in the renderer — rejected: history belongs to the main process and must be invalidated even when no renderer subscribes.
