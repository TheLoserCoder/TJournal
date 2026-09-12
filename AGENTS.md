# TJournal Engineering Constitution

## Read before changing code

1. Read this file.
2. Read the relevant product, architecture, engineering, roadmap, and ADR documents.
3. Check `docs/architecture/code-map.md` and search the existing code before creating a file, class, contract, adapter, route, or component.
4. Decide whether the request extends or contradicts an existing decision.

## Challenge poor decisions

Do not automatically accept a request that duplicates behaviour, breaks an invariant, weakens security, risks data loss, violates an ADR, or creates needless complexity. Explain the concrete impact, cite the affected code or document, and propose alternatives. If the owner explicitly insists, update the roadmap and ADR before implementing unless safety rules forbid the action.

## Architecture

- Use vertical modules: each business capability owns its domain, application, contracts, adapters, and presentation folders.
- Dependency direction is presentation -> application -> domain. Adapters implement ports owned by the consuming inner layer.
- `platform/*` owns only cross-cutting mechanics such as database connection, configuration, observability, numeric implementation, and desktop shell integration.
- Do not import an internal file from another module. Use its explicit public entry point.
- Domain and application must not import Electron, React, SQLite, Drizzle, filesystem APIs, or other infrastructure libraries.
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

## Testing and documentation

- Every behaviour change includes suitable tests.
- Every bug fix includes a regression test.
- Run the relevant tests, lint, typecheck, and architecture checks before reporting completion.
- Update `docs/architecture/code-map.md` in the same change when a module, public entry point, route, contract, adapter, or persistent data flow is added, moved, or removed.
- Update roadmap, ADR, and bug documentation when their scope changes.
