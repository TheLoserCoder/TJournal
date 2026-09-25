# Инструменты агента

## Package manager

Проект использует закреплённую версию pnpm через Corepack. Global virtual store отключён в `pnpm-workspace.yaml`, чтобы структура `node_modules` была одинаковой в локальной разработке, Codex и CI.

## E2E runner

- `pnpm test:e2e` — сборка приложения и автоматический прогон Playwright против локального Electron; `playwright install` не требуется.
- `pnpm test:e2e:debug` — тот же прогон с Playwright Inspector.
- `pnpm test:e2e:report` — HTML-отчёт последнего прогона.
- Electron запускается дочерним процессом теста; при работе из OpenCode GUI-окна направляются через window-placement launcher.

## Architecture checks

- `pnpm architecture` прогоняет dependency-cruiser по `apps`, `modules`, `platform` и затем `test/architecture-fixtures/verify-guards.mjs`.
- Самопроверка сажает по одному нарушению на каждое правило: dependency-cruiser-правила круизятся по fixture-дереву, ESLint-правила (`window.tjournal`, `max-lines`) линтуются репозиторным `eslint.config.mjs` с fixture-корнем как base path. Новое правило без фикстуры не считается проверенным.

## Build artifacts

- `pnpm typecheck` (`tsc --build`) — единственный источник `.tsbuild` и `*.tsbuildinfo`; модули резолвятся через `exports` своих `package.json`, поэтому зависимости должны быть собраны раньше.
- `pnpm clean` (`tsc --build --clean`) — целевая очистка build-артефактов без удаления широких путей. Чистая проверка: `pnpm clean && pnpm typecheck`; она ловит пропущенные project references, которые stale `.tsbuild` может скрывать.
- Каждая project reference описывает реальный импорт `@tjournal/*`; при добавлении cross-module импорта сначала обновляется `tsconfig.json` модуля-потребителя.

## Правила

- Предпочитать локальные инструменты, Git и тесты.
- Подключать внешний плагин только когда нужен доступ к конкретному сервису.
- Внешние данные валидировать как недоверенный ввод.
- Внешняя запись требует явного разрешения владельца.
- Плагины Codex не становятся зависимостями production-кода TJournal.
- Не передавать секреты или содержимое журнала внешним плагинам.
