# TJournal Engineering Constitution

## Read before changing code

1. Read this file.
2. Read the relevant product, architecture, engineering, roadmap, and ADR documents.
3. Check `docs/architecture/code-map.md` and search the existing code before creating a file, class, contract, adapter, route, or component.
4. Decide whether the request extends or contradicts an existing decision.

## Skills

Load and apply skills through the `skill` tool during development. Select only the skills relevant to the task; do not apply all of them mechanically.

Always relevant:

- `clean-code` — when writing, refactoring, or reviewing code quality.
- `clean-architecture` — when designing or reviewing layers, module boundaries, ports, and dependency direction.
- `web-design-guidelines` — when building or reviewing renderer UI.

Task-specific:

- Architecture or performance overhaul of an existing area — `architecture-optimization`: measure before optimizing, pin behaviour before restructuring, keep an optimization ledger.
- React components in general — `vercel-react-best-practices`, `vercel-composition-patterns`; add `react-component-performance` when profiling render cost or re-render thrash.
- Measured performance work across frontend, backend, or queries — `performance-optimization`.
- Instrumentation, logging, metrics, tracing, alerting — `observability-and-instrumentation`: adapt to the existing `platform/observability` Logger port and JSONL sink; do not add OpenTelemetry, Prometheus, or Redis without an ADR.
- Schema, indexing, migrations, query plans — `database-design`, `sql-optimization-patterns`: adapt examples to `node:sqlite` + Drizzle. PostgreSQL-only features (`pg_stat_statements`, `GIN`/`BRIN`, `CREATE INDEX CONCURRENTLY`, partitioning) are not available.
- Product/user measurement design (event taxonomy, KPI hierarchy) — `analytics-strategy`: this is not the `modules/analytics` trade-statistics domain; use it only when planning telemetry about app usage.

The skills are guidance. This constitution, the ADRs, and the architecture documents take precedence whenever they conflict. Skill examples target Node/Next.js/PostgreSQL; translate them to this repository's Electron, React 19, Vite, `node:sqlite`, Drizzle, and Decimal stack, and never copy them verbatim.

## Model roles and handoff

- Sol is the project planner and architect. Sol researches the repository, checks for conflicts with existing ADRs and architecture, chooses the implementation approach, decomposes the work, identifies affected contracts, edge cases, tests, acceptance criteria, and documentation updates.
- Terra and Luna are implementation agents. They execute the prepared plan within its stated boundaries and must not independently change architectural decisions, public contracts, the data model, or the scope without an explicit, evidence-based reason.
- A plan handed to an implementation agent must be detailed enough to execute without making unstated architectural decisions. It explicitly records the goal and scope, current implementation and integration points, affected modules and files, required type/API/IPC/schema/persistence changes, implementation order, validation and error-handling rules, edge cases, test scenarios, verification commands, completion criteria, and documentation updates.
- If an executor discovers ambiguity or a conflict with the plan, the executor first checks the existing rules and project documents, then reports a blocking question or discrepancy. It must not silently introduce a new architectural decision.
- Small and obvious changes may use a compact plan, but the plan must still state the expected result, affected area, and verification method.
- Model roles do not override the project constitution, security requirements, required checks, or the obligation to disclose unverified assumptions.

## Challenge poor decisions

Do not automatically accept a request that duplicates behaviour, breaks an invariant, weakens security, risks data loss, violates an ADR, or creates needless complexity. Explain the concrete impact, cite the affected code or document, and propose alternatives. If the owner explicitly insists, update the roadmap and ADR before implementing unless safety rules forbid the action.

## Architecture

- Use vertical modules: each business capability owns its domain, application, contracts, adapters, and presentation folders.
- Dependency direction is presentation -> application -> domain. Adapters implement ports owned by the consuming inner layer.
- `platform/*` owns only cross-cutting mechanics such as database connection, configuration, observability, numeric implementation, and desktop shell integration.
- Do not import an internal file from another module. Use its explicit public entry point.
- Domain and application must not import Electron, React, SQLite, Drizzle, filesystem APIs, or other infrastructure libraries.
- Renderer uses MVP: Views receive ViewModels and callbacks only; presenters own UI state and call typed renderer gateways; only gateway adapters may access preload APIs.
- Reusable presentation components such as `DataTable` may manage rendering mechanics, but receive only a ViewModel and callbacks. They must not contain CRUD, IPC, domain validation, persistence or command-history decisions.
- React View components must not call `window.tjournal`, contain persistence, domain validation, IPC handling, or command-history logic.
- Do not create global `utils`, `helpers`, `services`, `types`, or `common` dumping grounds.

## Dependency injection and external libraries

- Application services depend on typed port interfaces, never concrete adapters.
- Resolve dependencies only in composition roots. Do not pass a DI container into business code or use it as a service locator.
- Concrete adapters are instantiated only in a composition root or test setup.
- Hide third-party APIs behind adapters or presentation facades. Third-party types must not leak through domain or application public APIs.
- Do not create fake interfaces for pure functions, immutable value objects, data DTOs, or local presentational components.
- Prefer composition over inheritance. Use patterns only when they solve a present problem.

## Files, classes, and reuse

- One file has one primary responsibility and one primary export. Closely related small types, schemas, or helpers may stay beside it.
- Use a class only when state, lifecycle, or invariants require one. One primary class per file.
- Avoid god classes, god hooks, god services, and generic managers.
- ESLint warns above 300 lines. A file above 500 lines requires an explicit decomposition review recorded in the task or a nearby justified lint exception.
- Generated files, migrations, translation dictionaries, and test fixtures are exempt from the size guideline.
- Search for an existing contract or implementation before creating a new one. Reuse domain rules, but do not create speculative abstractions without a real consumer.

## Constants and configuration

- No magic strings, magic numbers, duplicated business rules, hardcoded user text, paths, colours, routes, or environment values.
- User-visible text is defined only in the i18n dictionary and accessed through named translation-key constants. Tests must use those constants or named test data, never copy UI text inline.
- Use named UI design tokens for radii, spacing, shadows, control dimensions and semantic colors. Secondary actions should be icon-first from the approved icon family, always with a localized `aria-label` and tooltip. Dynamic toolbars reserve their action area so state changes do not cause layout jumps; animations must be subtle and respect `prefers-reduced-motion`.
- A small file-local set of constants belongs at the top of its file.
- A larger local set belongs in a neighbouring `*.config.ts` file.
- Shared values belong to a named domain configuration module. User choices belong in settings. UI tokens belong in the design system. Text belongs in i18n.
- Immutable domain invariants remain named constants, enums, or value objects; do not turn them into user-editable configuration merely to remove literals.
- Environment configuration is loaded once, typed, and validated.

## TypeScript, errors, and data

- Use TypeScript strict mode. Do not use `any`, unexplained assertions, or non-null assertions.
- Use named exports and meaningful English identifiers.
- Validate all external input at the boundary with schemas.
- Finance calculations have one source of truth and tests. Do not use JavaScript floating-point arithmetic for monetary results.
- Do not swallow errors. Production code must use the Logger port, not `console.log`.
- Comments explain why, not what. TODOs require a task reference.

## Performance and large data

- Profile or identify the actual bottleneck before optimizing. Keep only changes that beat a recorded baseline; revert neutral ones.
- Never load an unbounded dataset into the client or memory. Use keyset pagination over deep offset, aggregate at the data layer, batch work, and virtualize long renderer lists.
- Prefer the simplest fix first — algorithm, query plan, index, batching — before adding a cache or new infrastructure. Do not introduce Redis, queues, microservices, or other infrastructure without a concrete measured need and an ADR.
- React changes must avoid unnecessary re-renders, oversized components, and global state without need, and must keep heavy synchronous work off the main thread.

## Testing and documentation

- Every behaviour change includes suitable tests.
- Every bug fix includes a regression test.
- Run the relevant tests, lint, typecheck, and architecture checks before reporting completion.
- Update `docs/architecture/code-map.md` in the same change when a module, public entry point, route, contract, adapter, or persistent data flow is added, moved, or removed.
- Update roadmap, ADR, and bug documentation when their scope changes.
