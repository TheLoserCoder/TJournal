# Карта проекта

Карта проекта — краткий источник навигации, а не полный список файлов. Она обновляется вместе с кодом при создании, перемещении или удалении модулей, публичных контрактов, маршрутов, адаптеров и потоков данных.

## Текущая структура

| Область                  | Назначение                                                                          | Публичная граница                  | Зависимости                   |
| ------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------- |
| `apps/desktop`           | Electron shell, bootstrap, preload, React entry points и конфигурация electron-vite | `@tjournal/desktop`                | Модули и platform-адаптеры    |
| `modules/trade`          | Будущая предметная область сделок                                                   | Пока не реализована                | `platform/numeric`, contracts |
| `modules/account`        | Будущая предметная область счетов                                                   | Пока не реализована                | contracts                     |
| `modules/instrument`     | Инструменты и категории активов                                                     | Пока не реализована                | `modules/icon-catalog`        |
| `modules/settings`       | Настройки журнала и приложения                                                      | Пока не реализована                | configuration                 |
| `modules/icon-catalog`   | Контракты и placeholders иконок                                                     | Пока не реализована                | presentation adapters         |
| `modules/journal`        | Контракт `JournalStorage`, vault use cases и минимальная закрытая сделка            | `@tjournal/journal`                | `platform/numeric`            |
| `modules/analytics`      | Аналитические запросы и метрики                                                     | Пока не реализована                | trade/account contracts       |
| `platform/configuration` | Runtime-конфигурация и пути локальных настроек                                      | `@tjournal/platform-configuration` | Zod                           |
| `platform/errors`        | Безопасные ошибки приложения и renderer DTO                                         | `@tjournal/platform-errors`        | Нет                           |
| `platform/observability` | Порт логирования и Pino JSONL adapter с retention/redaction                         | `@tjournal/platform-observability` | Pino                          |
| `platform/numeric`       | Нормализация точных десятичных значений                                             | `@tjournal/platform-numeric`       | Decimal.js                    |
| `platform/database`      | SQLite vault, миграция, проверка целостности и `JournalStorage` adapter             | `@tjournal/platform-database`      | node:sqlite, Drizzle          |
| `platform/ui`            | Будущие нейтральные UI primitives и design tokens                                   | Пока не реализована                | React presentation            |

## Поток приложения

```text
Renderer feature -> typed preload API -> main IPC handler -> application use case
  -> port interface -> platform/module adapter -> SQLite or file system
```

## Реализованные ключевые файлы

- `apps/desktop/src/main/desktop-container.ts` — единственный composition root Awilix в main process.
- `apps/desktop/src/main/register-ipc-handlers.ts` — typed IPC, безопасные DTO и диагностика.
- `apps/desktop/src/preload/index.ts` и `apps/desktop/src/shared/*` — единственная поверхность, доступная renderer.
- `modules/journal/src/contracts/journal-storage.ts` — контракт данных журнала без Electron, SQLite и файловой системы.
- `platform/database/src/sqlite-journal-storage.ts` — структура vault, SQLite, идемпотентная миграция и `integrity_check`.
