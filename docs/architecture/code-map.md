# Карта проекта

Карта проекта — краткий источник навигации, а не полный список файлов. Она обновляется вместе с кодом при создании, перемещении или удалении модулей, публичных контрактов, маршрутов, адаптеров и потоков данных.

## Текущая структура

| Область                  | Назначение                                                                          | Публичная граница   | Зависимости                   |
| ------------------------ | ----------------------------------------------------------------------------------- | ------------------- | ----------------------------- |
| `apps/desktop`           | Electron shell, bootstrap, preload, React entry points и конфигурация electron-vite | `@tjournal/desktop` | Модули и platform-адаптеры    |
| `modules/trade`          | Будущая предметная область сделок                                                   | Пока не реализована | `platform/numeric`, contracts |
| `modules/account`        | Будущая предметная область счетов                                                   | Пока не реализована | contracts                     |
| `modules/instrument`     | Инструменты и категории активов                                                     | Пока не реализована | `modules/icon-catalog`        |
| `modules/settings`       | Настройки журнала и приложения                                                      | Пока не реализована | configuration                 |
| `modules/icon-catalog`   | Контракты и placeholders иконок                                                     | Пока не реализована | presentation adapters         |
| `modules/journal`        | Файл журнала, backup и import/export use cases                                      | Пока не реализована | database, desktop adapters    |
| `modules/analytics`      | Аналитические запросы и метрики                                                     | Пока не реализована | trade/account contracts       |
| `platform/configuration` | Типизированная конфигурация                                                         | Пока не реализована | Нет                           |
| `platform/observability` | Logger и диагностика                                                                | Пока не реализована | desktop adapters              |
| `platform/numeric`       | Адаптер точной арифметики                                                           | Пока не реализована | Decimal.js adapter            |
| `platform/database`      | Общий SQLite connection, migrations, transactions и integrity                       | Пока не реализована | SQLite adapter                |
| `platform/ui`            | Будущие нейтральные UI primitives и design tokens                                   | Пока не реализована | React presentation            |

## Поток приложения

```text
Renderer feature -> typed preload API -> main IPC handler -> application use case
  -> port interface -> platform/module adapter -> SQLite or file system
```
