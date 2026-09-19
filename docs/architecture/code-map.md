# Карта проекта

Карта проекта — краткий источник навигации, а не полный список файлов. Она обновляется вместе с кодом при создании, перемещении или удалении модулей, публичных контрактов, маршрутов, адаптеров и потоков данных.

## Текущая структура

| Область                  | Назначение                                                                          | Публичная граница                  | Зависимости                |
| ------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------- | -------------------------- |
| `apps/desktop`           | Electron shell, bootstrap, preload, React entry points и конфигурация electron-vite | `@tjournal/desktop`                | Модули и platform-адаптеры |
| `modules/trade`          | Агрегат сделки, Decimal-расчёты, валидация, R и use cases                           | `@tjournal/trade`                  | `platform/numeric`         |
| `modules/account`        | Счета, жизненный цикл, account-specific 1R, cash movements и read model баланса     | `@tjournal/account`                | `platform/numeric`         |
| `modules/instrument`     | Инструменты, категории, профили расчёта и жизненный цикл                            | `@tjournal/instrument`             | `platform/numeric`         |
| `modules/settings`       | Настройки журнала и приложения                                                      | Пока не реализована                | configuration              |
| `modules/icon-catalog`   | Контракты и placeholders иконок                                                     | Пока не реализована                | presentation adapters      |
| `modules/journal`        | Vault и каталог инструментов; не владеет сделками                                   | `@tjournal/journal`                | Нет                        |
| `modules/analytics`      | Сопоставимая статистика по USD, %, R и календарным периодам                         | `@tjournal/analytics`              | `modules/trade`            |
| `platform/configuration` | Runtime-конфигурация и пути локальных настроек                                      | `@tjournal/platform-configuration` | Zod                        |
| `platform/errors`        | Безопасные ошибки приложения и renderer DTO                                         | `@tjournal/platform-errors`        | Нет                        |
| `platform/observability` | Порт логирования и Pino JSONL adapter с retention/redaction                         | `@tjournal/platform-observability` | Pino                       |
| `platform/numeric`       | Нормализация точных десятичных значений                                             | `@tjournal/platform-numeric`       | Decimal.js                 |
| `platform/database`      | SQLite-сессия, миграции и отдельные journal/account/instrument/trade adapters       | `@tjournal/platform-database`      | node:sqlite, Drizzle       |
| `platform/ui`            | Будущие нейтральные UI primitives и design tokens                                   | Пока не реализована                | React presentation         |

Renderer design-system boundary: `apps/desktop/src/renderer/styles/design-tokens.css` owns reference, semantic and component tokens; `styles/design-system.css` owns presentation primitives and visual composition. `styles.css` assembles Tailwind, calendar styles, token styles and legacy rules isolated in the `legacy` cascade layer. `components/ui/*` remains presentation-only; feature CSS owns layout only. `features/journal/account-selection.ts` owns the pure selection reconciliation rule, while `use-journal-workspace-presenter.tsx` owns the controlled account selection and vault-scoped preference. Domain, application, preload, IPC and database layers do not depend on these files.

## Поток приложения

```text
Renderer feature -> typed preload API -> main IPC handler -> application use case
  -> port interface -> platform/module adapter -> SQLite or file system
```

Для зависимых представлений поток продолжается после транзакции: `SQLite triggers -> data_revisions -> CommittedChangeCoordinator -> data:changed -> renderer presenter -> analytics worker -> summary ViewModel`. Worker читает только снимок vault и не участвует в записи. Account read model агрегирует opening balance, saved trade USD impacts и отдельные cash movements; analytics считает только trades и показывает accounted balance отдельным полем.

## Реализованные ключевые файлы

- `apps/desktop/src/main/desktop-container.ts` — единственный composition root Awilix в main process.
- `apps/desktop/src/main/register-ipc-handlers.ts` — typed IPC, безопасные DTO и диагностика.
- `apps/desktop/src/preload/index.ts` и `apps/desktop/src/shared/*` — единственная поверхность, доступная renderer.
- `apps/desktop/src/renderer/gateway/*` — renderer adapter к preload; `features/*/*presenter*` — MVP presenter; `features/*/*view*` — чистые React Views.
- `apps/desktop/src/renderer/components/ui/*` — presentation-only Radix/Base UI/DayPicker wrappers, включая единый компактный календарь в режимах выбора даты и диапазона с header reset, прямой `TimeField`, `DirectionToggle` и `SelectionToolbar`; `components/data-table.tsx` — нейтральная TanStack Table/View с portal filters и визуальным resize-guide; `features/journal/use-journal-workspace-presenter.tsx` и `use-trades-table-presenter.tsx` — UI-state и callbacks без gateway/IPC в View.
- `features/journal/trades-page-view.tsx` — компактное рабочее место сделок; `trade-details-dialog-view.tsx`, `trade-summary-settings-dialog-view.tsx` и `table-layout-dialog-view.tsx` — чистые Views диалогов. Временные поля подробной формы явно disabled и не меняют модель сделки или SQLite.
- `modules/journal/src/contracts/journal-storage.ts` — контракт данных журнала без Electron, SQLite и файловой системы.
- `platform/database/src/sqlite-journal-storage.ts` — структура vault, SQLite, идемпотентная миграция и `integrity_check`.
- `platform/database/src/sqlite-vault-database.ts` — общая SQLite-сессия, read-only worker-сессия, транзакционные миграции и data revisions; `sqlite-trade-store.ts` — сделки, выходы, профили и vault-настройки риска.
- `platform/database/src/sqlite-account-store.ts` и `sqlite-instrument-store.ts` — dedicated adapters для CRUD/lifecycle/defaults, account-specific risk и Decimal-based account balance projection; migrations `006-accounts-assets` и `007-cash-movements` добавляют account attribution, risk defaults, movement records и revision triggers.
- `apps/desktop/src/renderer/features/journal/accounts-assets-page-view.tsx` и `use-accounts-assets-presenter.ts` — Accounts/Assets workspace; account and instrument changes проходят через typed gateway, history и committed-change invalidation. Account identity and the visual cost-profile editor are separate presentation concerns; assets remain global instruments.
- `modules/trade/src/domain/*` — canonical result, one-source USD/%/R conversion, точная валидация, формула исполнения, классификация результата и остатки выходов; browser-safe `@tjournal/trade/calculations` публикует общие вычисления для renderer. `modules/analytics/src/calculate-trade-summary.ts` строит независимую от таблицы торговую статистику на том же authoritative net USD результате.
- `apps/desktop/src/main/committed-change-coordinator.ts` и `preload/data-change-schema.ts` — typed invalidation events с ревизиями и поколением vault; `main/analytics-worker-client.ts`/`analytics-worker.ts` — ограниченный Piscina worker для read-only пересчёта статистики.
