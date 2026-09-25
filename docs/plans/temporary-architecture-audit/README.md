# Temporary architecture audit plans

> Temporary handoff documents. These files are execution aids, not permanent architecture documentation.

## Goal

Stabilize the current TJournal implementation without a rewrite, then make the primary journal path bounded and restore the intended Clean Architecture boundaries before adding larger product features.

The plans were prepared against the current working tree on 2026-09-21. That tree already contained a large uncommitted feature set. Executors must inspect `git status` before every phase and must not overwrite, revert, or reformat unrelated work.

## Mandatory execution order

1. [08 — Product follow-ups](08-product-followups.md)

The bounded journal contract (plan 04) is implemented: the renderer loads pages through `trades.page`, the old unbounded route is removed, and `docs/adr/0013-bounded-journal-table-read-model.md` records the design.

Plan 05 (IPC and application boundaries) is implemented: capability registrars, application commands behind a `CommandHistory` port, executable architecture guards with a fixture self-test and the file-size policy are recorded in `docs/adr/0014-ipc-application-command-boundaries.md` and roadmap task FND-025.

Plan 06 (module and dependency cleanup) is implemented: `modules/instrument` is the sole instrument catalog owner, `JournalStorage` owns the vault lifecycle only, `platform/numeric` and the unused placeholder packages and dependencies are removed, and ADR-0002/code-map describe parameterized `node:sqlite` persistence. Recorded as roadmap task FND-026.

Plan 07 (vault backup and recovery) is implemented: verified WAL snapshots, pre-migration and manual backups, bounded listing and automatic retention, restore to a new vault with unique identity, offline recovery from an inaccessible source, and Electron E2E. ADR-0015, `docs/engineering/backup-recovery.md` and roadmap task FND-028 hold the permanent decisions.

## Rules for every executor

- Read root `AGENTS.md`, relevant docs, ADRs, and `docs/architecture/code-map.md` first.
- Load the skills named by the plan.
- Treat existing uncommitted files as owner work. Do not reset, revert, or broadly reformat them.
- Pin current behavior with focused tests before restructuring it.
- Keep domain/application independent of Electron, React, SQLite, Drizzle, filesystem APIs, and worker APIs.
- Keep renderer flow `View -> presenter -> RendererGateway -> preload -> IPC -> use case -> port -> adapter`.
- Do not introduce Redis, a server, queues, OpenTelemetry, or another database.
- Validate all IPC and filesystem input at the boundary.
- Keep money and financial comparisons exact; do not replace Decimal-backed rules with JavaScript floating point.
- Any behavior change needs tests. Any confirmed bug needs a regression test and an entry in `docs/bugs/README.md`.
- Update `docs/architecture/code-map.md` whenever a public contract, adapter, route, module, or persistent flow changes.
- Update the relevant ADR instead of leaving a decision only in a temporary plan.
- Run the verification commands listed in the plan and report anything that could not be run.

## Completion and deletion protocol

Each plan is temporary. When one plan is fully complete:

1. Ensure permanent information has been moved to code, tests, roadmap, ADRs, code-map, performance notes, and bug documentation as required.
2. Delete that plan file in the same change.
3. Remove its link from this README.
4. Delete this README and the directory after the final plan is completed or explicitly rejected by the owner.

Do not delete a plan merely because part of it was implemented. Mark the permanent roadmap task with its real status and leave the temporary plan until all completion criteria are satisfied.
