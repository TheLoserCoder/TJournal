# ADR-0014: IPC registration and application command boundaries

## Status

Accepted.

## Context

After the data contracts stabilized, `apps/desktop/src/main/register-ipc-handlers.ts` had grown into one file that registered every unrelated capability (vault, tags, trades, accounts, instruments, cash movements, history, settings, analytics). It also:

- decided archive-vs-physical-delete restoration and rebuilt snapshots/defaults inline;
- called concrete SQLite stores (`SqliteAccountStore`, `SqliteInstrumentStore`) directly;
- received the whole Awilix cradle as a service-locator-shaped parameter;
- used `list().find(...)` for point snapshots because no point/snapshot use cases existed;
- published committed changes itself while the history orchestration was mixed into the same handler.

ADR-0003 keeps business rules, persistence and command execution in the main process, but it does not say where main-process orchestration belongs. The architecture checks could not see npm or workspace dependencies, so they described boundaries without enforcing them. `UndoRedoHistory.undo()`/`redo()` popped a command before applying it, so a failed inverse silently dropped the command from both stacks.

## Decision

- `apps/desktop/src/main/register-ipc-handlers.ts` is composition only: it builds the shared `IpcRegistrationContext` (logger, safe-result logging, committed-change capture, Electron window transport) and delegates to capability registrars (`registerVaultIpcHandlers`, `registerTagIpcHandlers`, `registerTradeIpcHandlers`, `registerAccountIpcHandlers`, `registerInstrumentIpcHandlers`, `registerHistoryIpcHandlers`, `registerSettingsIpcHandlers`, `registerDiagnosticsIpcHandlers`, `registerAnalyticsIpcHandlers`).
- Each registrar registers exactly its documented channels, parses external input with Zod schemas, converts errors to safe results, and publishes the command's changed resources only after a successful mutation. Registrars receive narrow dependency interfaces, never the Awilix cradle; concrete adapters are constructed only in `desktop-container.ts` (the analytics worker entry point is a separate composition root for its read-only session).
- Undo/Redo orchestration lives in focused application commands under `apps/desktop/src/main/application/`: `TagCommands`, `CashMovementCommands`, `AccountCommands`, `InstrumentCommands`, `TradeCommands`, `TradePreferencesCommands`. Each command owns loading the prior snapshot through inward use cases, choosing the inverse operation, executing through the `CommandHistory` port, and returning `CommandOutcome { value, changedResources }`. One-line read/query routes stay in their registrar.
- `CommandHistory` is owned by the application layer (`application/command-history.ts`); `UndoRedoHistory` implements it in the outer layer. Application code never imports the adapter.
- `UndoRedoHistory` wraps every `execute`, `undo` and `redo` in the application-owned `CommandTransaction` port (`application/command-transaction.ts`, implemented by `history/sqlite-command-transaction.ts` over the active vault transaction) and moves a command between stacks only after the wrapped operation succeeded. A multi-step inverse therefore rolls back completely, a failed inverse never enters the opposite stack, and a failed command stays retryable without leaving half-restored state.
- Missing point/snapshot use cases were added where `list().find(...)` or adapter-specific methods were used: `GetCashMovementByIdUseCase`, `ListAccountDefaultsUseCase`, `ListInstrumentDefaultsUseCase`, `RestoreAccountSnapshotUseCase` and `RestoreInstrumentDefaultsUseCase` in `modules/account`; `GetInstrumentProfileUseCase` and `SaveInstrumentProfileUseCase` in `modules/instrument`.
- Instrument calculation profiles have one owner: `modules/instrument` defines the profile type and use cases, `SqliteInstrumentStore` is the only writer of `instrument_calculation_profiles`, and the `instrument-profiles:*` channels are registered by `register-instrument-ipc-handlers.ts`. `TradeStore` reads a profile only through the injected instrument port. The public IPC channels, DTO schemas and SQLite schema are unchanged.
- Architecture guards live in `dependency-cruiser.cjs` and `eslint.config.mjs`: inner layers (`domain`, `application`, `contracts`) and desktop application commands cannot import apps, platform adapters, Electron, React, SQLite, Drizzle, filesystem/process/worker APIs, concrete history/database adapters or IPC registrars; Views cannot import gateway/preload; cross-module imports use documented public entry points; IPC registrars cannot import database adapters; `max-lines` is an error above 500 production lines with recorded exceptions. `test/architecture-fixtures/verify-guards.mjs` plants one violation per rule: dependency-cruiser rules are cruised over the fixture tree and ESLint rules are linted with the repository config from the fixture base path, so both checks fail when a rule stops reporting.

## Consequences

- Adding a capability means adding one registrar plus, when it mutates undoable data, one command class; the top-level composition file stays small.
- Undo snapshot and inverse policies are application-tested with fake ports; registrar tests assert registered channels, payload validation and publication.
- Public preload/desktop API, IPC channels, DTO schemas and SQLite behavior are unchanged.
- History invariants are now regression-tested: a failed inverse propagates, stays retryable, and its partial writes are rolled back by the command transaction.
- The architecture check reports external and workspace dependencies, so the guards fail on real violations instead of passing because a module is invisible to the graph; the same command also proves that both dependency-cruiser and ESLint guards still report their planted violations.
- Instrument profiles no longer have two writers: the trade adapter reads profiles only through the instrument port, and profile writes go through instrument use cases.
- `DesktopDependencies` remains the Awilix cradle and still exposes adapter instances for DI resolution; it is no longer a handler parameter.

## Alternatives considered

- Keep orchestration in IPC handlers and only split files — rejected: the transport layer would keep business snapshot/inverse decisions.
- Move Undo/Redo commands into business modules — rejected: session history is a desktop interaction concern; modules must not depend on a command-history port they do not otherwise need.
- Introduce a generic command bus — rejected: explicit capability commands keep contracts readable and avoid a speculative abstraction.
- Split `register-ipc-handlers.ts` mechanically by channel groups without application commands — rejected: it would move code without restoring the boundary.
- Add a separate `architecture-selftest` CI job — rejected: running the fixture verification inside `pnpm architecture` keeps one verification command.
