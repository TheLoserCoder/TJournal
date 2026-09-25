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
- Storage contract: the journal domain depends only on `JournalStorage`; the SQLite implementation stays in `platform/database`.
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

- Status: In progress (automated verification complete; visible Electron smoke remains).
- Goal: Add vault-scoped trading accounts and a lifecycle-managed instrument catalog, then provide the account boundary used by the account-bound accounting slice below.
- Delivered: `modules/account` and `modules/instrument` public domain/application contracts; idempotent migration `006-accounts-assets`; dedicated SQLite account/instrument/trade adapters; account balance projection and uncovered coverage; account/instrument archive/restore and physical-delete semantics; typed IPC/preload/gateway operations; optional account attribution and Decimal-based impact derivation; historical instrument-symbol snapshots; Accounts & Assets navigation page; analytics account filtering support; revision resources and undoable mutations.
- Constraints: balance is a projection, not mutable state; defaults are entry-time only; account-bound trade conversion and cash movements are implemented by FND-013.
- Closeout: Accounts/Assets/Tags share the extracted `useDataTableController`; the account default editor is presenter-owned (`accountDraft`, `accountDefaultsStatus`) and blocks saving an existing account until its profiles are readable, so a failed read can never replace them (UI-017); bulk delete/restore lives in `CatalogPresenter.requestBulkAction` — a confirmed sequential walk of single commands that stops on the first failure and keeps the remaining ids for retry, with `ConfirmDialog` `busy` protection; category labels are localized in the catalog, editor and quick-create.
- Verification: `pnpm check` (90 файлов / 393 теста), `pnpm test:e2e` (10 сценариев), `pnpm format:check`, `pnpm build`, `pnpm clean && pnpm typecheck`; визуальный smoke снимками Electron 1280×800 и 960×640 выполнен для тулбара и ключевых страниц (Light/Dark), интерактивная ручная проверка остаётся за владельцем.

## FND-013 — Account-bound USD accounting and quick-entry conversion

- Status: In progress (automated verification complete; visible Electron verification remains).
- Goal: Require a real vault-scoped account for new trades, keep USD/%/R as quick-entry converters, persist one authoritative `netResultUsd`, and add account-bound deposits/withdrawals without mixing cash flow into trading P&L.
- Delivered: mandatory create-trade schema account boundary; account-specific remembered positive `1R, USD`; exact USD/%/R conversion snapshots; metadata-stable trade updates; `007-cash-movements` migration; atomic positive deposit/withdrawal validation; history-backed cash movement CRUD; separate accounted-balance summary; onboarding dialog; special movement entry mode and unified trade-table rows; recent-use searchable instrument ordering; shared popup width behavior; stable quick-entry layout, guarded table-selection reset and widened responsive details dialog.
- Rules: ordinary trade edits may make an account negative; percent conversion requires a positive current balance; withdrawals cannot exceed a complete current known balance; cash movements never affect trade counts, win rate or trading P&L.
- Legacy handling: old accountless trades are retained and visibly excluded from complete account balances. The review entry point reports a visible message when the stale warning finds no unassigned trade; assignment through the historical trade editor preserves a known USD result and requires an explicit USD result for an unresolved `%/R` — it is never rebased from the current balance. A failed save keeps the editor draft (UI-018).
- Tests: exact conversion unit coverage, metadata/net regression, raw legacy cash assignment preservation and unresolved-percentage resolution in `platform/database/src/sqlite-trade-update.test.ts`, legacy lookup feedback in `use-journal-workspace-presenter.test.tsx`, cash movement arithmetic and excessive-withdrawal regression, existing suite compatibility. Final smoke still requires account onboarding, USD/%/R entry, deposit, rejected withdrawal and separate P&L/balance confirmation in a visible Electron window.
- Verification: `pnpm check` (90 файлов / 393 теста), `pnpm test:e2e` (10 сценариев), `pnpm format:check`, `pnpm build`; визуальный smoke в Electron остаётся ручным.

## FND-014 — Renderer design system and visual redesign

- Status: In progress (overlay stabilization and common toolbar pass implemented; Electron visual smoke remains)
- Goal: Перевести renderer на единую compact-professional визуальную систему по мотивам Figma-референса, не меняя функциональность и публичные domain/application/IPC контракты.
- Scope: layered CSS tokens (`reference -> semantic -> component`), самостоятельные Light/Dark palettes, shell, common controls, tables, KPI/summary, forms, dialogs, states and responsive composition.
- Constraints: Dashboard content and new analytics are out of scope; presenters, gateways, preload, SQLite, use cases and persistence remain unchanged; all user-visible text continues to come from i18n dictionaries.
- Documentation: `docs/architecture/design-system.md`, ADR-0008, project map and this task entry.
- Acceptance: all renderer primitives use documented tokens; Light/Dark/Auto states are visually coherent; Trades, Accounts & Assets, Settings, dialogs, tables and empty/error states share one component vocabulary; KPI summary stays grouped in a full-width row above the Trades table, with one compact desktop line split into financial, performance and asset groups; Accounts & Assets stays top-aligned; ordinary Add uses the sidebar-linked primary indigo treatment, while secondary accent and accent ghost cover quieter actions; close/delete icon foregrounds are always red/rose; account dropdown selection never oscillates after user choice; selected table rows keep their height; compact calendar/time and select/combobox overlays share one base and motion policy; no clipping or toolbar layout jumps; existing behavior and tests remain intact.
- Delivered in this pass: explicit controlled filter close/open state, shared exit motion policy, dismiss/edit icon roles, direct blur-safe `TimeField`, compact header-reset calendar, reusable L/S `DirectionToggle` in quick-entry and detailed trade, fixed selection action order, reserved Accounts/Assets toolbar geometry, and narrower responsive detailed-trade dialog.
- Responsive pass: `.page-content` is the adaptation container; Trades summary, toolbar and table reflow through container queries (`72rem`/`56rem`/`45rem`) instead of viewport breakpoints; quick-entry and selection toolbar share one grid cell with `inert`/`aria-hidden` on the inactive layer; DataTable takes its width from `table.getTotalSize()` and exposes a focusable scroll region with tokenized scrollbar; CSS ownership is split into `styles/data-table.css` and `features/journal/trades-page.css`.
- Toolbar pass: quick-entry is a single compact row with proportional columns and one control height for selects, text fields, autocomplete and `DirectionToggle`; below `56rem` the fields wrap on a three-column grid, the actions move to their own row and the details label collapses to an icon.
- Details pass: `Combobox` keeps the typed text until a real option is chosen, so the asset field is editable in the details dialog; exits render as a column-aligned mini-table with one volume selector in the section heading and a single manual-result field without a unit selector.
- Verification: renderer tests plus `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm architecture`, `pnpm format:check`, `pnpm build`. Layout was additionally measured in a real Electron/Chromium window against the production CSS at 1600×800, 1280×800, 1100×800, 960×640, 800×700 и 620×700: документ и `.page-content` не имеют горизонтального overflow, тулбар не перекрывает таблицу, таблица получает локальную горизонтальную прокрутку только когда колонки шире контейнера (620 px), а переключение на selection layer не меняет высоту рабочей области. Интерактивный визуальный smoke в видимом окне Electron остаётся ручным шагом.
- Closeout follow-up: кнопка тегов и число конверсии закреплены в своих колонках тулбара быстрого ввода (`minmax(5rem/7rem, max-content)`, `grid-column: 7/8`, сброс на ≤56rem), поэтому на 1280×800 подпись тегов не обрезается; проверено снимками Electron 1280×800 и 960×640 (UI-020), регрессия закреплена в `styles/design-system.test.ts`.

## FND-015 — Типизированные фильтры таблиц и единый USD-результат

- Status: In progress (core filter system, unified USD result column, shared entry-type palette and docs implemented; interactive Electron smoke remains)
- Goal: Сделать фильтрацию одинаковой и полной для всех таблиц, показывать результат сделки в одном authoritative USD-виде и гарантировать, что новая колонка не появится без фильтра.
- Delivered: контракт `DataTableColumnFilterSchema`; exhaustive filter-схемы для Trades/Accounts/Assets, где отсутствие фильтра у новой колонки — ошибка typecheck и regression-тест; общие панели `NumberFilterPanel` (greater/less/between через Decimal), `TextFilterPanel`, `DateTimeRangePanel`, `CheckboxListPanel`; единый предикат для сделок и движений денег; колонка «Результат» и её сортировка/числовой фильтр по `netResultUsd` (только сумма и режим, без выбора единицы); исходная единица `USD/%/R` отдельной колонкой со своим фильтром; поле 1R вынесено из тулбара в настройки вида таблицы, при пустом значении открывается диалог ввода с подсказкой; кнопка сброса всех фильтров в тулбаре рядом с настройками вида и локальный сброс внутри панели; пер-колоночная подсветка активного фильтра; popup-списки ограничены высотой viewport; компактные grid-треки quick-entry вместо собственных `min-width` полей; компактные минимумы ширины колонок (48/56 px); компактные боковые отступы рабочей области и минимальная зарезервированная высота таблицы; единая палитра типов long/short/deposit/withdrawal через component tokens для `DirectionToggle` и table badges; типизированные фильтры analytics.
- Rules: `greater than`/`less than` строгие, `between` включительный; обратный диапазон показывает ошибку и не применяется; legacy `%/R` без сохранённого USD отображается как недоступное и не пересчитывается по текущему балансу; фильтры session-only и не меняют SQLite, IPC-маршруты или application settings.
- Documentation: ADR-0009, `docs/architecture/design-system.md`, проектная карта, `docs/product/scope-v1.md`, журнал дефектов.
- Acceptance: все data-колонки трёх таблиц имеют фильтр по своему типу данных; `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm architecture`, `pnpm format:check`, `pnpm build` проходят; ручной smoke проверяет Light/Dark/Auto, keyboard focus, узкое окно, popup у края экрана и отсутствие layout jump при появлении сброса.

## FND-016 — Statistics workspace and analytics report

- Status: Implemented (automated verification complete; visible Electron smoke remains).
- Goal: Replace the Statistics placeholder with an offline analytical workspace for exact USD KPI, win rate, drawdown, time series and account/instrument/category breakdowns.
- Delivered: typed `analytics.report` preload/IPC contract; revision-safe read-only Piscina execution; analytics application use case and inward-owned streaming fact-source port; SQLite iterator adapter with UTC/account/instrument/category/direction filters; exact Decimal KPI, coverage, profit factor, average trade, max drawdown, bounded time buckets and breakdown rows; current catalog category semantics; Statistics MVP presenter/View, persisted chart preferences, RU/EN filters, lazy Recharts facades, equivalent data tables and responsive token-based layout.
- Performance: final adapter measured a 100 000-row streaming scan at 677.80 ms all-time (93.34 ms for a 14 285-row one-year range) and full reports at 1 959 ms (instrument breakdown, all time), 2 807 ms (account breakdown, all time) and 253 ms (one-year); existing `trades_closed_at_idx` is used, so no speculative index was added. Details: `docs/engineering/analytics-performance.md`.
- Rules: cash movements never enter trading P&L; uncovered legacy trades are visible only through coverage; report responses are capped at 400 series points and 50 breakdown rows; percentage return/drawdown remains out of scope until a TWR/MWR decision.
- Documentation: ADR-0010, project map, renderer design system, v1 scope and performance baseline.
- Verification: focused domain/SQLite/schema/presenter tests, a worker integration test (job -> read-only vault -> bounded report), full test suite, lint, typecheck, architecture, format check and build. Visible Electron Light/Dark/narrow-window/keyboard smoke remains manual.
- Follow-up: добавлена часовая детализация (`hour`) для диапазона в пределах двух суток с непрерывной осью (день показывает все 24 часа), ограничение толщины столбцов, themed tooltip, единая компактная высота контролов панели фильтров и появление кнопки сброса только при активном фильтре (см. UI-010).
- Follow-up UI-013: страница статистики выровнена по верху (`align-content: start`) — заголовок и фильтры больше не съезжают при пустом отчёте; селект периода и кнопка сброса переведены на primitive-модификатор `ui-control-compact`, поэтому их высота совпадает с мультиселектами, а паддинг островка фильтров стал компактным.

## FND-017 — Trade table order, settings slimming and inline conversion

- Status: Implemented (automated verification complete; visible Electron smoke remains).
- Goal: Убрать страницу «Главная» и стартовать со сделок, привести порядок колонок и цвета типов к рабочему виду, упростить страницу настроек и показать перевод результата в USD прямо в тулбаре.
- Delivered: `ApplicationPage` без `dashboard` и навигация из четырёх разделов; канонический порядок колонок сделок `Результат → Актив → Тип → Счёт → Дата` (порядок владеет конфиг, сохранённые ширины/видимость остаются пользовательскими); «Счёт» виден в компактном режиме; цвета пополнения и вывода поменяны местами (пополнение — фиолетовый, вывод — жёлтый/warning); страница настроек сведена к карточке «Интерфейс» (тема, язык), формы риска и расчёта инструментов удалены, `use-trade-settings-presenter` оставлен только для нейтральных границ/затрат диалога сводки и сохраняет vault `riskBinding`; инлайн-результат перевода в USD (`= 125,5 USD`) в тулбаре сразу после поля результата и единицы, подсказка под тулбаром удалена, база процента — tooltip.
- Rules: процентный результат и 1R берутся от текущего известного баланса счёта, а не от начальной суммы; порядок колонок не является пользовательской настройкой (drag-сортировки в таблице нет).
- Documentation: `docs/architecture/design-system.md`, `docs/architecture/code-map.md`, `docs/product/scope-v1.md`, ADR-0009.
- Verification: `pnpm check` (lint, typecheck, architecture, 159 tests) и `pnpm format:check`; визуальный smoke в Electron остаётся ручным.

## FND-018 — Asset creation guard, asset type column and inline conversion

- Status: Implemented (automated verification complete; visible Electron smoke remains).
- Goal: Не создавать актив из пустого поля, дать выбирать тип нового актива, показать тип актива в таблице сделок и не резервировать место под перевод результата.
- Delivered: guard на пустой символ в `createTrade` и выключенная кнопка «Добавить», пока символ актива пуст; `AssetCreateDialogView` вместо `ConfirmDialog` — неизвестный символ открывает создание актива с выбором типа (`INSTRUMENT_CATEGORIES`, дефолт `DEFAULT_INSTRUMENT_CATEGORY`), а не молчаливый `forex`; новая колонка «Тип актива» в таблице сделок (категория из карты инструментов, локализованные подписи через `INSTRUMENT_CATEGORY_LABEL_KEYS`, multi-select фильтр, скрыта в компактном режиме и включается в настройках вида); инлайн-перевод `= 125,5 USD` рендерится только при непустом результате, трек `minmax(0, max-content)` больше не держит место.
- Rules: пустой символ актива никогда не инициирует создание актива; у каждой новой data-колонки обязателен типизированный фильтр (contract из ADR-0009); порядок колонок остаётся каноническим.
- Documentation: `docs/architecture/design-system.md`, `docs/architecture/code-map.md`, `docs/product/scope-v1.md`.
- Verification: `pnpm check` (lint, typecheck, architecture, 167 tests) и `pnpm format:check`; визуальный smoke в Electron остаётся ручным.
- Follow-up: 1R из настроек вида таблицы теперь запоминается на счёте (`defaultRiskUsd`) и не сбрасывается при перезапуске или смене счёта; иконка настроек унифицирована (lucide `Settings`), а Undo/Redo перенесены в одну строку с названием приложения (см. UI-011).

## FND-019 — Vault settings and validation

- Status: Implemented (automated verification complete; visible Electron smoke remains).
- Goal: Дать управлять vault со страницы настроек: видеть текущий путь, менять vault, открывать папку и проверять, что указанная папка — корректный vault.
- Delivered: карточка «Vault» на странице настроек (`VaultSettingsView` + `use-vault-settings-presenter.ts`); порт `VaultFolderOpener` и Electron-adapter `shell.openPath`; typed IPC `vault:validate` и `vault:reveal-in-folder`; не изменяющая активную сессию проверка `JournalStorage.inspectVault` (маркер + наличие базы + `PRAGMA integrity_check` на отдельном read-only соединении); смена vault через нативный диалог с проверкой кандидата до замены активного vault; коды `vault-invalid` и `vault-not-accessible` различимы в сообщении.
- Rules: проверка кандидата и кнопки «Vault» не меняют активный vault при ошибке; смена vault проходит через существующий gateway/use case и сбрасывает историю/поколение vault; пользовательский текст только из i18n.
- Documentation: `docs/architecture/code-map.md`, `docs/product/scope-v1.md`.
- Verification: `pnpm test` (storage `inspectVault` + renderer App vault card), `pnpm lint`, `pnpm typecheck`, `pnpm architecture`, `pnpm format:check`, `pnpm build`; визуальный smoke в Electron остаётся ручным.

## FND-020 — Tag catalogue and trade assignments

- Status: Implemented (automated verification complete; visible Electron smoke remains).
- Goal: Дать пользователю каталог цветных тегов с комментариями, привязку нескольких тегов к сделке и отдельную колонку в таблице сделок.
- Delivered: модуль `@tjournal/tag` (домен, детерминированный `suggestTagColor`, use cases, снимок удаления для Undo) и browser-safe `@tjournal/tag/palette`; migration `008-tags` с `tags`/`trade_tags`, cascading delete и revision-ресурсами `tags`/`trade-tags`; typed IPC `tags.list/create/update/delete-many` и preload/gateway; третья вкладка «Теги» страницы «Счета, активы и теги» с таблицей (название, комментарий, число сделок), быстрым созданием и полным редактором с палитрой и textarea; multi-select `TagPicker` в quick-entry и в диалоге сделки; колонка «Теги» в таблице сделок с overflow `+N` и popover; multi-select фильтр с опцией «Без тегов»; палитра из десяти мягких цветов в design tokens Light/Dark.
- Rules: тег хранит только идентификатор цвета; `ClosedTrade` хранит `tagIds`, а каталог резолвится в renderer; trade-owned порт `TradeTagReferenceReader` не даёт trade-модулю зависеть от tag-домена; удаление тега каскадно снимает связи и восстанавливается Undo; лимит 32 тега на сделку и 64/500 символов для названия/комментария; фильтр тегов не передаётся в analytics.
- Documentation: ADR-0011, `docs/architecture/code-map.md`, `docs/architecture/design-system.md`, `docs/product/scope-v1.md`, `docs/adr/README.md`.
- Verification: `pnpm check` (lint, typecheck, architecture, 212 tests) и `pnpm format:check`; доменные/SQLite/IPC/renderer тесты покрывают уникальность, палитру, каскад и Undo; визуальный smoke в Electron остаётся ручным.
- Follow-up UI-012: фиксированная подпись кнопки тегов с `is-active` подсветкой вместо summary (тулбар не прыгает; пустой трек конверсии схлопывается); тултип комментария тега в таблице с задержкой 500 мс; inline-создание тега в `TagPicker` и актива в `Combobox`; удаление комментариев из строк пикера; выбранные теги в диалоге сделки с кнопками-крестиками; пустая таблица отличается от пустого результата фильтра и центрируется по обеим осям (сделки — `journal.empty`, счета/активы/теги — собственные сообщения каталога).

## FND-021 — Целостность vault-сессии и атомарные записи сделок

- Status: Implemented (automated verification complete; visible Electron smoke remains).
- Goal: Не допускать команд старого vault в новой сессии, не оставлять частично записанные R-сделки и не заменять активный vault при ошибке кандидата.
- Delivered: `VaultSessionCoordinator` как единая активация vault (проверка кандидата → сброс ревизий → очистка Undo/Redo → запоминание пути); `UndoRedoHistory.reset()`; порт `TradeUnitOfWork` и `SqliteTradeUnitOfWork`; вложенные транзакции через savepoints в `SqliteVaultDatabase`; атомарная запись сделки и `defaultRiskUsd` в create/update use cases; миграция кандидата на отдельном соединении в `SqliteJournalStorage`; `resolveResultInput` восстанавливает пересчёт authoritative USD при правке результата в диалоге (DB-005).
- Rules: успешный IPC-ответ означает, что и сделка, и запомненный риск закоммичены; неудачный или отменённый кандидат не меняет активный vault и историю; история и события инвалидации относятся только к открытому vault.
- Documentation: ADR-0012, журнал дефектов (DB-002…DB-005), проектная карта.
- Verification: `pnpm check` (lint, typecheck, architecture, 235 tests) и `pnpm format:check`; визуальный smoke в Electron остаётся ручным.
- Hardening follow-up: replacement connection открывается до закрытия активного, transaction depth переживает ошибку `COMMIT`, а ошибка записи recent-path логируется без ложного failed IPC (DB-008).

## FND-022 — Electron E2E и accessibility foundation

- Status: Implemented (automated verification complete).
- Goal: Дать критическим потокам исполняемую проверку в реальном Electron и базовый accessibility-gate.
- Delivered: Playwright-каркас против локального Electron с изолированным `userData` и очередью выбора папки, включаемой только при `TJOURNAL_E2E=1`; smoke-сценарии (vault/account onboarding, USD-сделка и перезапуск, Undo/Redo, percent-конверсия, deposit/withdrawal и отказ сверх баланса, смена vault с очисткой истории, блокирующий Escape); axe-сканирование онбординга, сделок, диалога деталей, каталога, статистики и настроек через инъекцию `axe-core`; keyboard-проверки (Tab-порядок toolbar/таблицы/sidebar, редактирование строки, возврат фокуса после Escape); сохранение trace/screenshot и workspace-логов при падении.
- Rules: E2E запускается только против production-сборки; тесты не касаются реальных vault и preferences; сканирование ожидает завершения анимаций (иначе axe ловит ложный контраст); новый serious/critical axe-impact без ревью валит тест.
- Fixes: UI-014 (доступное имя icon-кнопки деталей, возврат фокуса в примитиве `Dialog`, контраст активной навигации и `.table-muted`).
- Verification: `pnpm test:e2e` (7 сценариев), `pnpm check` (237 tests), `pnpm format:check`.
- Documentation: `docs/engineering/testing.md`, `docs/engineering/tooling.md`, `docs/bugs/README.md`, проектная карта.

## FND-023 — Точечные чтения и ресурсная инвалидация

- Status: Implemented (automated verification complete; visible Electron smoke remains).
- Goal: Убрать полные сканы ради одной строки, N+1 запросы и лишние полные refresh на каждое изменение.
- Delivered: `TradeStore.getTradeById` и point lookups для счёта/актива/тега с отдельными use cases; batch-загрузка выходов сделки чанками; set-based проекция `listAccounts` из grouped read models с сохранением Decimal-точности; IPC update/delete и `UpdateTradeUseCase` используют точечные чтения; renderer обновляет только затронутые группы данных (`refresh-resources.ts`), `RefreshScheduler` коалесцирует события и ведёт single-flight, fallback 250 мс покрывает потерянное событие; мутация больше не дублирует event-driven refresh; benchmark и query-count regression-тесты.
- Metrics: `listTrades` 502 → 3 statement-а, `listAccounts` 501 → 5, `getTradeById` 3 statement-а (0.2 мс на 5k), quick summary 3 statement-а; см. `docs/engineering/query-performance.md`.
- Rules: количество запросов списка не зависит от числа строк; связанные строки читаются batch-ем; деньги не считаются через SQLite `REAL`; полный refresh выполняется при старте и смене поколения vault; новое событие инвалидации обязано иметь запись в матрице `refresh-resources`.
- Documentation: `docs/engineering/query-performance.md`, проектная карта, roadmap.
- Verification: `pnpm check` (254 tests), `pnpm test:e2e` (7 сценариев), `pnpm format:check`.
- Hardening follow-up: ресурс `trades` также инвалидирует account projection, поэтому derived balance и следующий percent preview не остаются устаревшими (UI-015).

## FND-024 — Bounded journal table read model

- Status: Implemented (automated verification complete; visible Electron smoke remains).
- Goal: Заменить неограниченный `trades.list` на keyset-пагинированный read model и виртуализированный renderer.
- Delivered: порт `JournalTableReader` в `modules/trade`; `SqliteJournalTableReader` с фильтрами и allowlist-сортировками в SQLite, keyset-курсором, точными Decimal-границами (`tjournal_decimal_cmp`) и cap страницы 200; `TradeStore.getTradesByIds`; typed IPC `trades.page` и точечный `trades:get` с Zod-схемами и маппером; renderer переведён на страницы (сброс при смене фильтров/сорта/ревизии, fallback-окно до измерения контейнера, виртуализация с spacer-строками и подгрузкой соседних страниц у обеих границ окна), выбор и удаление загруженных строк с явной подписью; счётчики тегов через `tags:counts`; старый unbounded-маршрут удалён из API/preload/gateway/IPC.
- Metrics: `readPage` limit 100 на журнале 5k — 3.9 мс и 5 statement-ов; page DTO не содержит executions/exits, редактор загружает полную сделку через `trades:get`, renderer удерживает максимум три страницы и восстанавливает соседние страницы двунаправленным keyset cursor; E2E-прокрутка подгружает вторую страницу из 120 записей.
- Rules: фильтры, сортировки и курсор выполняются в SQLite; `CAST(... AS REAL)` допустим только как ключ сортировки; stored/displayed money остаются точными строками; новые колонки обязаны либо входить в sort allowlist, либо не показывать сортировку.
- Documentation: ADR-0013, `docs/engineering/query-performance.md`, `docs/product/scope-v1.md`, проектная карта.
- Verification: `pnpm check` (65 файлов / 249 tests), `pnpm test:e2e` (8 сценариев), `pnpm format:check`.
- Hardening follow-up: Decimal comparator регистрируется на каждом новом vault connection (DB-006), combined tag filter реализует `selected OR untagged` (DB-007), row identity включает тип агрегата, page trade DTO не переносит executions/exits, а renderer удерживает максимум три страницы (UI-016).
- Hardening verification: `pnpm check` (67 файлов / 262 tests), `pnpm test:e2e` (8 сценариев), `pnpm format:check`.

## FND-025 — Границы IPC и application-команд

- Status: Implemented (automated verification complete; visible Electron smoke remains).
- Goal: Вернуть задуманную границу controller/use-case/port после стабилизации контрактов: IPC только регистрирует каналы, парсит внешний ввод и публикует изменения; Undo/Redo-оркестрация живёт в application-командах; архитектурные проверки реально запрещают нарушения, а не описывают их.
- Delivered: `register-ipc-handlers.ts` стал композицией (общий `IpcRegistrationContext` + capability-registrar-ы vault/tag/trade/account/instrument/history/settings/diagnostics/analytics); application-команды `TagCommands`, `CashMovementCommands`, `AccountCommands`, `InstrumentCommands`, `TradeCommands`, `TradePreferencesCommands` с портом `CommandHistory`; недостающие point/snapshot use cases в `modules/account` (`GetCashMovementByIdUseCase`, `ListAccountDefaultsUseCase`, `ListInstrumentDefaultsUseCase`, `RestoreAccountSnapshotUseCase`, `RestoreInstrumentDefaultsUseCase`); инвариант `UndoRedoHistory` (неудачная инверсия не переносится в противоположный стек и остаётся повторяемой); расширенные dependency-cruiser и ESLint-правила; fixture-самопроверка `test/architecture-fixtures/verify-guards.mjs`; `max-lines` — ошибка выше 500 production-строк с записанными исключениями.
- Rules: регистраторы получают узкие интерфейсы зависимостей, concrete adapters создаются только в `desktop-container.ts`; публикация `data:changed` происходит только после успешной команды; публичные каналы, DTO-схемы, preload API и SQLite-поведение не менялись; архитектурные правила видят npm/workspace-зависимости, поэтому правило без фикстуры больше не считается проверкой.
- Tests: registrar-тесты (точный набор каналов, валидация payload, отсутствие публикации при ошибке), тесты шести наборов команд (снимки и инверсии на фейковых портах), adapter-интеграция восстановления снимков (`platform/database/src/undo-snapshot-restore.test.ts`), regression-тесты `undo-redo-history`, fixture-проверка архитектурных правил.
- Documentation: ADR-0014, `docs/architecture/code-map.md`, `docs/engineering/coding-rules.md`.
- Verification: `pnpm check` (83 файла / 336 тестов, 7 архитектурных правил подтверждены фикстурами), `pnpm test:e2e` (8 сценариев, включая Undo/Redo и смену vault), `pnpm format:check`, `pnpm build`; визуальный smoke в Electron остаётся ручным.

## FND-026 — Консолидация владения и чистка неиспользуемых пакетов

- Status: Implemented (automated verification complete; visible Electron smoke remains).
- Goal: Убрать дублирующее владение инструментами, мёртвые пакеты-заглушки и дрейф зависимостей после стабилизации поведения и IPC-границ.
- Inventory (перед удалением): ни один рантайм-вызов не использовал legacy instrument API `modules/journal`; `platform/numeric` не имел ни одного импорта в коде; Drizzle не импортировался ни в production, ни в тестах; `modules/settings`, `modules/icon-catalog`, `platform/ui` содержали только `export {}`; `@tanstack/react-query` и `react-hook-form` не имели импортов; `@tanstack/react-virtual` используется виртуализацией `DataTable` и оставлен; `decimal.js` оставлен как private implementation dependency точной арифметики.
- Delivered: `JournalStorage` и `SqliteJournalStorage` владеют только жизненным циклом vault; удалены legacy instrument domain/use cases/public exports и регистрации в `desktop-container.ts`; тесты переведены на `SqliteInstrumentStore`; удалён пакет `platform/numeric` вместе с зависимостями и tsconfig-references; удалены неиспользуемые `drizzle-orm`, `drizzle-kit`, `@tanstack/react-query`, `react-hook-form` и пакеты-заглушки; добавлена команда `pnpm clean` (`tsc --build --clean`) и исправлена отсутствовавшая project reference `modules/trade -> modules/instrument`, из-за которой чистый build зависел от stale `.tsbuild`; ADR-0002 и карта проекта приведены к фактическому выбору persistence.
- Rules: схема БД, история миграций, имена таблиц/колонок и каталоги `attachments/`/`backups/` не менялись; seed каталога инструментов остаётся инфраструктурной миграцией и не возвращает journal владение инструментами; Decimal не заменён на JavaScript `number`. Продуктовое направление «icon import» из фазы Detail не требует placeholder-пакета: при реализации соответствующий модуль создаётся заново.
- Tests: полный suite, `pnpm test:e2e`, чистый `pnpm clean && pnpm typecheck` без stale-артефактов, `pnpm architecture` (в графе нет удалённых пакетов), lockfile без зависимостей удалённых пакетов.
- Documentation: ADR-0002, `docs/architecture/code-map.md`, `docs/engineering/tooling.md`, roadmap.
- Verification: `pnpm check`, `pnpm test:e2e`, `pnpm format:check`, `pnpm build`, `pnpm audit --prod`; визуальный smoke в Electron перенесён в FND-027.

## FND-027 — Hardening границ после review планов 05–06

- Status: Implemented (automated verification complete; visible Electron smoke remains).
- Goal: Закрыть дефекты, найденные при независимом review FND-025/FND-026: частично применённая инверсия Undo, остаточное двойное владение профилями расчёта, raw-ошибки vault picker, пробелы executable guards и неточная документация.
- Delivered: порт `CommandTransaction` (`application/command-transaction.ts`, реализация `history/sqlite-command-transaction.ts`) оборачивает `execute`/`undo`/`redo` в транзакцию активного vault, поэтому многошаговая инверсия откатывается целиком, а команда остаётся повторяемой; профили расчёта консолидированы в `modules/instrument` (`GetInstrumentProfileUseCase`, `SaveInstrumentProfileUseCase`, нормализация через `normalizeCalculationProfile`), `SqliteInstrumentStore` — единственный writer `instrument_calculation_profiles`, каналы `instrument-profiles:*` перенесены в `register-instrument-ipc-handlers.ts`, `TradeStore` больше не пишет и не читает профиль напрямую, а `CreateTradeUseCase` получает его через instrument-порт; `vault:create`/`vault:open` целиком обёрнуты в `asAsyncResult`, поэтому отказ нативного picker превращается в safe result с логом; dependency-cruiser-правила расширены на `modules/*/src/contracts` и desktop application-команды (запрет concrete history/database adapters и инфраструктуры); fixture-самопроверка `verify-guards.mjs` проверяет и dependency-cruiser (9 правил), и ESLint (`window.tjournal`, `max-lines`) от fixture-корня.
- Rules: публичные IPC-каналы, DTO-схемы, preload API и SQLite-схема не менялись; миграции и имена таблиц/колонок не менялись; нормализация профиля стала строже и каноничнее (как в create/update актива), численно нулевые значения (`0`, `0.0`, `00.000`) отклоняются на IPC-границе как validation error, научная нотация больше не принимается; Decimal не заменён на JavaScript `number`.
- Tests: regression-тест транзакционного отката частичной инверсии (`undo-redo-history.test.ts`), тест отказа vault picker (`register-vault-ipc-handlers.test.ts`), тест нормализации профиля (`save-instrument-profile-use-case.test.ts`), перенос регистрации каналов профиля в instrument-registrar-тесты, полный suite, fixture-самопроверка обоих механизмов guards.
- Documentation: ADR-0014 (транзакционная граница команд, единственный владелец профиля, расширенные guards), ADR-0002, `docs/architecture/code-map.md`, `docs/engineering/coding-rules.md`, `docs/engineering/tooling.md`, `docs/bugs/README.md` (DB-009…DB-011).
- Verification: `pnpm check`, `pnpm test:e2e`, `pnpm format:check`, `pnpm build`, `pnpm audit --prod`; визуальный smoke в Electron (Undo после ошибки, сохранение профиля актива) остаётся ручным.

## FND-028 — Vault backup и recovery

- Status: Implemented (automated verification complete; visible Electron smoke from FND-027 remains manual).
- Goal: проверенный SQLite/WAL snapshot до миграции существующего vault и по ручному действию, сохранение и восстановление без перезаписи активных данных.
- Delivered: `node:sqlite.backup()` на отдельном read-only соединении; версионированный Zod-манифест, SHA-256 и `integrity_check`; атомарный staging/rename, ограниченный список с keyset-страницами по 50, удержание 20 валидных automatic backups без удаления manual; `OpenVaultUseCase` проверяет миграционный ledger и делает снимок до миграции; restore создаёт новый marker UUID с lineage в пустой выбранной папке и не переключает сессию; typed IPC/preload/gateway, Vault settings с проверкой и восстановлением; офлайн `tools/recover-vault.mjs` восстанавливает из копии, когда исходный vault повреждён и не открывается; локализованные безопасные ошибки.
- Tests: реальный WAL, corrupted/unsupported manifest, interrupted snapshot, retention, отсутствие pending-миграций, ошибка pre-migration backup без изменения активной сессии, occupied destination, 51 manual snapshot с пагинацией, IPC validation и Electron E2E manual backup → restart → restore → explicit open.
- Documentation: ADR-0015, `docs/engineering/backup-recovery.md` с процедурой и измерениями 10/100/256 МиБ, product scope и карта проекта.
- Verification: `pnpm check`, `pnpm test:e2e`, `pnpm format:check`, `pnpm build`, opt-in backup benchmark.

## FND-029 — Качественный торговый журнал: заметки и review

- Status: Implemented (automated verification complete; Electron E2E passes).
- Goal: дать трейдеру возможность сохранять причину входа и post-trade review рядом с количественными результатами сделки.
- Accepted scope: nullable `entryNote` и `reviewNote`, статус `unreviewed`/`reviewed`, редактирование в форме создания и деталях сделки, поиск по заметкам из существующей таблицы. Теги остаются таксономией setup/strategy; отдельная strategy-сущность и вложения не входят в слайс.
- Confirmed rules: максимум 4 000 Unicode code points на каждое поле; при сохранении обрезаются только внешние пробелы, пустое после trim сохраняется как `NULL`, внутренние пробелы/переносы сохраняются; новые и существующие записи по умолчанию `unreviewed`; статус меняется только явно и не зависит от текста review.
- Delivered: `ClosedTrade` несёт `entryNote`/`reviewNote`/`reviewStatus`; `modules/trade` владеет лимитом и нормализацией (`domain/trade-note-rules.ts`, browser-safe `@tjournal/trade/note-rules` для renderer-а); migration `009-trade-notes-and-review` добавляет nullable notes и constrained `review_status` с legacy default `unreviewed`; IPC Zod-схемы валидируют текст и передают только issue code/path; `JournalTableFilters.textQuery` ищет Unicode-aware lowercase подстроку по row ID и обеим заметкам в bounded SQLite query, а page DTO не раскрывает содержимое заметок; trade details View получил presenter-owned note drafts и явный review status; guard `main-process-must-use-compiled-module-entries` запрещает main/preload/shared импортировать browser-safe TS-подпути (main использует скомпилированный корень `@tjournal/trade`).
- Rules: notes/status входят в Undo/Redo snapshots; изменение только заметок/status сохраняет `netResultUsd`, account attribution и financial input snapshots без пересчёта; заметки не попадают в логи и safe error context; pre-migration backup остаётся обязательным; существующие IPC/preload routes и DTO расширены аддитивно.
- Tests: границы 4 000 code points и Unicode (`trade-validation.test.ts`), нормализация/пустые значения и legacy defaults (`sqlite-trade-note-migration.test.ts`), create/update без изменения финансового результата и account snapshot (`sqlite-trade-update.test.ts`), Undo/Redo точного snapshot (`trade-commands.test.ts`), поиск по каждой заметке без утечки содержимого в page DTO и логи (`journal-table-reader.test.ts`, `register-trade-ipc-handlers.test.ts`), UI-поля заметок (`trade-details-tags.test.tsx`, `use-trade-editor-presenter.test.ts`), E2E редактирование → перезапуск → поиск (`test/e2e/trade-notes.spec.ts`).
- Documentation: ADR-0016, product scope, `docs/architecture/code-map.md`, временный handoff плана 08 (disposition слайса A).
- Verification: `pnpm check` (87 файлов / 362 tests), `pnpm test:e2e` (10 сценариев), `pnpm format:check`, `pnpm build`.

## FND-030 — Терминальный редизайн renderer: единые primitives и процентная графика

- Status: Implemented (automated verification complete; интерактивный визуальный smoke в Electron остаётся ручным).
- Goal: привести весь renderer к одному терминальному визуальному языку по референсу `stitch_(2).zip`, унифицировать кнопки, списки, вкладки и диалоги и добавить процентную графику, не меняя функциональность, домены, IPC и persistence.
- Delivered: новая палитра токенов (`--ref-brand-*` thermal orange, графитовые поверхности Dark, самостоятельный Light, тёмная подпись `--color-accent-ink` на заливке действия), mono-типографика чисел (`--ref-font-sans`/`--ref-font-mono`, `.ui-numeric`, tabular-nums в таблицах), токенизированные скроллбары страницы, диалогов, popup-ов, тегов и статистики, sticky header/footer и padding диалога, `TabList` (`components/ui/tab-list.tsx`) вместо feature-local вкладок каталога, общий `Select` вместо нативного `<select>` выбора резервной копии, удаление вариантов `success` и `secondary-accent` (подтверждение — `primary`, добавление/повтор/отмена — один `secondary`), шкалы `ui-meter` в KPI статистики и сводке сделок, conic-gradient `ResultDistributionRing` для wins/losses/neutral, tone-границы KPI и breakdown-столбцы positive/negative, polished оси/сетка/tooltip существующих Recharts-фасадов, обновлённый вид таблиц, summary, тулбара и страницы настроек.
- Rules: подтверждение — `primary`, удаление — `danger`, отмена и добавление строки — `secondary`; переключение вида внутри страницы — только `TabList`, списки — `Select`/`Combobox`; проценты всегда дублируются точным значением; зелёный остаётся финансовой семантикой; новые данные и расчёты не добавляются — кольцо и шкалы используют существующие `kpis.winRatePercent`, `winningTrades`, `losingTrades`, `neutralTrades`; бинарные шрифты не поставляются, offline-сборка не получает новых зависимостей.
- Tests: контракт `design-system.test.ts` расширен (терминальные токены и контраст действия, отсутствие `--button-success-`/`.ui-button-success`, наличие `ui-tab-list`/`ui-tab`/`ui-meter`, sticky chrome и скроллбары диалога, mono-числа статистики и таблиц, `.statistics-performance-layout`/`ring`/tone-границы, `.trade-summary-meter`), существующие renderer-тесты и axe-сканирование проходят без изменений.
- Documentation: ADR-0008 (Amendment 2026-09-24), `docs/architecture/design-system.md` (токены, типографика, scrollbar, chrome диалога, каталог компонентов, правила 10–12, протокол проверки), `docs/architecture/code-map.md`.
- Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`, `pnpm build`, измерение адаптивности в реальном Electron-окне на 1600×900, 1280×800, 1100×800, 960×640 и 620×700 (zoom/devtools), `pnpm test:e2e`; интерактивный Light/Dark smoke остаётся ручным.

## FND-031 — Синяя палитра, выровненная быстрая сводка и кольцо винрейта

- Status: Implemented (automated verification complete; интерактивный визуальный smoke в Electron остаётся ручным).
- Goal: заменить терминальный оранжевый акцент FND-028 на согласованную синюю палитру и устранить визуальные дефекты быстрой сводки и тулбара, не меняя функциональность, домены, IPC и persistence.
- Delivered: `--ref-brand-*` стал синей ramp действия (`500` заливка `#2563eb`, `600` текст `#1d4ed8`, `--ref-brand-ink` белая подпись); edit/info переведён на indigo, ряд графиков — blue → teal → violet → amber; Light/Dark сохраняют независимые mappings. Винрейт быстрой сводки показывает компактное кольцо `components/charts/win-rate-ring.tsx` по доменному `winRate` рядом с точным процентом (горизонтальная шкала удалена). Группы сводки получают пропорцию по числу карточек (2 + 5 + 2), поэтому девять карточек одинаковой ширины и высоты, каждая с локализованной подписью и тематической иконкой. Сетка быстрого ввода добавляет трек конверсии только при непустом `%`/`R`-превью и сужается до трёх полей в режиме пополнения/вывода. Подсказки используют тематическую поверхность `--color-surface-elevated`.
- Rules: подтверждение — `primary`, удаление — `danger`, отмена/добавление — `secondary`; проценты дублируются точным значением; новые данные и расчёты не добавляются — кольцо использует существующий `winRate`; `ResultDistributionRing` сохраняется для долей wins/losses/neutral; пользовательские tag-цвета не меняются.
- Tests: `design-system.test.ts` (условные треки конверсии/движения, синий контраст действия, отсутствие `--ref-dark-brand: #ff8a5c`, `ui-win-rate-ring`), `trade-summary-view.test.tsx` (кольцо при `winRate` и его отсутствие при `null`), `trades-page-view.test.tsx` (`data-conversion`/`data-entry-kind` и три поля движения).
- Documentation: ADR-0008 (Amendment 2026-09-24 FND-031), `docs/architecture/design-system.md` (палитра, кольцо, условные треки, tooltip, протокол контраста), `docs/architecture/code-map.md`, `docs/bugs/README.md` (UI-020).
- Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`, `pnpm build`, `pnpm test:e2e`; интерактивный Light/Dark smoke и измерение адаптивности в Electron остаются ручными.

## Правило задач

Каждая следующая задача содержит цель, зависимости, затрагиваемые контракты, критерии приёмки, тестовые сценарии, документацию для обновления и статус.
