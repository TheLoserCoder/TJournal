# Задачи

## FND-001 — Базовый шаблон проекта

- Status: Done
- Goal: Create the workspace, documentation, architecture guardrails, Electron shell based on electron-vite, and verification commands.
- Acceptance: Git repository exists; `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` work; the Electron shell opens; project map and AGENTS.md exist.
- Tests: root checks, a renderer smoke test, and a main-process configuration test.

## FND-002–FND-005 — Platform Core, Vault, onboarding и первая сделка

- Status: Done
- Goal: Safely create/open a local SQLite vault and record the first minimal closed trade.
- Delivered: `AppError`, JSONL Pino logging with 30-day retention, typed configuration, Awilix main-process composition root, typed preload/IPC, native vault picker, recent vault preference, integrity check, RU/EN onboarding, system theme auto mode, and minimal trade form/table.
- Storage contract: the journal domain depends only on `JournalStorage`; the SQLite/Drizzle implementation stays in `platform/database`.
- Tests: safe errors, runtime configuration, UI onboarding, vault creation/reopening/integrity/trade persistence, refusal to overwrite a non-empty folder.

## FND-006 — Journal workspace and instrument catalog

- Status: Done
- Delivered: MVP renderer boundary, sidebar workspace, basic trades CRUD, seeded vault-scoped instruments, application settings, and session Undo/Redo.
- Constraints: the detail form currently edits only date, instrument and result; accounts and extended trade fields remain separate tasks.

## Правило задач

Каждая следующая задача содержит цель, зависимости, затрагиваемые контракты, критерии приёмки, тестовые сценарии, документацию для обновления и статус.
