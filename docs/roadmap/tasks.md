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

## FND-007 — Универсальная таблица и рабочее место сделок

- Status: Done
- Goal: Replace the temporary trade list with a reusable presentation table built on TanStack Table.
- Delivered: adaptive Excel-like headers, sorting, column resizing and layout persistence, Compact/Advanced modes, header filters, safe filtered-row selection, and transactionally undoable bulk deletion.
- Constraints: the generic table has no business or persistence logic; prices, commissions and accounts remain separate trade-model work.

## FND-008 — Compact UI kit and table filters

- Status: Done
- Goal: Introduce a compact accessible renderer design system and remove clipping from table header filters.
- Delivered: Radix-backed presentation primitives, portal-based table filters, custom selects and checkboxes, localized date-range calendar, multi-asset filter prioritizing instruments used in trades, and presenter-owned workspace UI state.
- Constraints: UI state and layout preferences remain renderer/application settings concerns; SQLite, journal use cases and IPC contracts do not change.

## FND-009 — Полировка рабочего места сделок

- Status: Done
- Goal: Make the trade workspace compact, stable and visually coherent without expanding the trade domain.
- Delivered: compact rounded toolbar, Base UI-backed free-text asset autocomplete, icon-first selected-row actions, modal table-view drafts, full-height table viewport, resize guide, canonical Result/Asset/Date order and semantic result tones.
- Constraints: account, risk, prices, commissions and partial closures are disabled visual prototypes in the details dialog; they are not persisted and do not change SQLite, IPC or journal use cases.

## FND-010 — Расширенная сделка, R-результат и быстрая статистика

- Status: Done
- Goal: Make direction, exact execution calculations, partial exits, R snapshots and comparable quick statistics part of the persisted trade aggregate.
- Delivered: dedicated `trade` and `analytics` modules, split SQLite vault/trade adapters, transactional v3 migration, Long/Short, cash/percent/R results, instrument calculation profiles, execution snapshots, exact Decimal calculations, vault risk and neutral-range settings, historical R rebinding, safe validation issues, detailed trade form and compact summary controls.
- UI follow-up: statistics controls and break-even boundaries are grouped in a settings dialog; the shared calendar supports both a single date and a range; filter resets use icon actions; unchanged trade edits are accepted without a validation round-trip.
- Statistics follow-up: summary calculation is independent from the trade table and uses a zero break-even range by default; vault preferences can include commission and spread when classifying calculated USD results, and the table reuses the same classification tone.
- Constraints: accounts and account-specific 1R overrides remain a later slice. Future precedence is `account 1R -> vault 1R -> R without an equivalent`.

## FND-011 — Событийная инвалидация и неблокирующая статистика

- Status: Done
- Goal: Развязать изменения SQLite и потребителей статистики, автоматически обновлять зависимые представления и не блокировать main process тяжёлым пересчётом.
- Delivered: ревизии `data_revisions` и SQLite-триггеры; typed `data:changed` IPC event; coordinator с поколением vault; очередь Piscina с отменой устаревшей задачи; read-only SQLite worker; подписка renderer и coalesced refresh; фильтр статистики по пересечению с таблицей по явной настройке.
- Acceptance: trade/instrument/preferences/profile/history changes publish invalidation; negative trade regression updates `worstInstrument`; worker bundle builds; old analytics request cannot overwrite unmounted presenter; tests/typecheck/build pass.
- Documentation: ADR-0005, ADR-0006, project map and bug log.

## FND-012 — Accounts & Assets workspace

- Status: In progress (core vertical slice implemented; final UI/table-controller and full end-to-end verification remain).
- Goal: Add vault-scoped trading accounts and a lifecycle-managed instrument catalog, then provide the account boundary used by the account-bound accounting slice below.
- Delivered: `modules/account` and `modules/instrument` public domain/application contracts; idempotent migration `006-accounts-assets`; dedicated SQLite account/instrument/trade adapters; account balance projection and uncovered coverage; account/instrument archive/restore and physical-delete semantics; typed IPC/preload/gateway operations; optional account attribution and Decimal-based impact derivation; historical instrument-symbol snapshots; Accounts & Assets navigation page; analytics account filtering support; revision resources and undoable mutations.
- Constraints: balance is a projection, not mutable state; defaults are entry-time only; account-bound trade conversion and cash movements are implemented by FND-013.
- Remaining acceptance work: finish the generic table-controller extraction and use it for Accounts/Assets, complete the account-default editor and confirmations/bulk actions, add the dedicated FND-012 regression suite, and run the full Electron smoke checklist after dependencies are repaired.

## FND-013 — Account-bound USD accounting and quick-entry conversion

- Status: In progress (core persistence, conversion, IPC and entry UI implemented; legacy migration UX and visible Electron verification remain).
- Goal: Require a real vault-scoped account for new trades, keep USD/%/R as quick-entry converters, persist one authoritative `netResultUsd`, and add account-bound deposits/withdrawals without mixing cash flow into trading P&L.
- Delivered: mandatory create-trade schema account boundary; account-specific remembered positive `1R, USD`; exact USD/%/R conversion snapshots; metadata-stable trade updates; `007-cash-movements` migration; atomic positive deposit/withdrawal validation; history-backed cash movement CRUD; separate accounted-balance summary; onboarding dialog; special movement entry mode and unified trade-table rows; recent-use searchable instrument ordering; shared popup width behavior; stable quick-entry layout, guarded table-selection reset and widened responsive details dialog.
- Rules: ordinary trade edits may make an account negative; percent conversion requires a positive current balance; withdrawals cannot exceed a complete current known balance; cash movements never affect trade counts, win rate or trading P&L.
- Legacy handling: old accountless trades are retained and visibly excluded from complete account balances. Assignment through the historical trade editor preserves known USD results; unresolved legacy conversion needs an explicit future migration flow and is not silently rebased.
- Tests: exact conversion unit coverage, metadata/net regression, cash movement arithmetic and excessive-withdrawal regression, existing suite compatibility. Final smoke still requires account onboarding, USD/%/R entry, deposit, rejected withdrawal and separate P&L/balance confirmation in a visible Electron window.

## FND-014 — Renderer design system and visual redesign

- Status: In progress (overlay stabilization and common toolbar pass implemented; Electron visual smoke remains)
- Goal: Перевести renderer на единую compact-professional визуальную систему по мотивам Figma-референса, не меняя функциональность и публичные domain/application/IPC контракты.
- Scope: layered CSS tokens (`reference -> semantic -> component`), самостоятельные Light/Dark palettes, shell, common controls, tables, KPI/summary, forms, dialogs, states and responsive composition.
- Constraints: Dashboard content and new analytics are out of scope; presenters, gateways, preload, SQLite, use cases and persistence remain unchanged; all user-visible text continues to come from i18n dictionaries.
- Documentation: `docs/architecture/design-system.md`, ADR-0008, project map and this task entry.
- Acceptance: all renderer primitives use documented tokens; Light/Dark/Auto states are visually coherent; Trades, Accounts & Assets, Settings, dialogs, tables and empty/error states share one component vocabulary; KPI summary stays grouped in a full-width row above the Trades table, with one compact desktop line split into financial, performance and asset groups; Accounts & Assets stays top-aligned; ordinary Add uses the sidebar-linked primary indigo treatment, while secondary accent and accent ghost cover quieter actions; close/delete icon foregrounds are always red/rose; account dropdown selection never oscillates after user choice; selected table rows keep their height; compact calendar/time and select/combobox overlays share one base and motion policy; no clipping or toolbar layout jumps; existing behavior and tests remain intact.
- Delivered in this pass: explicit controlled filter close/open state, shared exit motion policy, dismiss/edit icon roles, direct blur-safe `TimeField`, compact header-reset calendar, reusable L/S `DirectionToggle` in quick-entry and detailed trade, fixed selection action order, reserved Accounts/Assets toolbar geometry, and narrower responsive detailed-trade dialog.
- Verification: renderer tests plus `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm architecture`, `pnpm format:check`, `pnpm build`, and Electron visual smoke at desktop and narrow widths.

## Правило задач

Каждая следующая задача содержит цель, зависимости, затрагиваемые контракты, критерии приёмки, тестовые сценарии, документацию для обновления и статус.
