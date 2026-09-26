# Инструменты агента

## CodeGraph и Task Master (OpenCode)

- Запускать OpenCode из корня TJournal: CodeGraph работает с текущим workspace, Task Master получает абсолютный путь к корню через `projectRoot`. Оба доступны как MCP-инструменты OpenCode и не входят в зависимости приложения. Проверено: инкрементальная индексация CodeGraph, поиск `CreateTradeUseCase`, индекс/семантический поиск документа; Task Master 0.43.1 — создание, чтение, смена статуса и выбор следующей задачи.
- При значимой работе с кодом сначала `codegraph_reindex_workspace` (без `force`), затем поиск символов и нужных связей/влияния. После изменения исходников обновить индекс; для архитектурных выводов сверяться с кодом, тестами, `docs/architecture/code-map.md` и ADR. `codegraph_index_markdown` индексирует один файл по абсолютному пути; после правок документа повторить вызов. Список проверять через `codegraph_list_doc_sources`, содержимое — через `codegraph_search_docs`. Это поисковый индекс, а не место для редактирования документов.
- CodeGraph 0.20.1 не применяет `.gitignore` как полный список исключений. User-scoped MCP-команда запускается с повторяемыми `--exclude` для `node_modules`, `.git`, `.tsbuild`, `out`, `release`, `playwright-report` и `test-results`. Путь к `codegraph-mcp` зависит от машины и не коммитится. После добавления или изменения исключений нужен один `codegraph_reindex_workspace(force: true)`: инкрементальная индексация не удаляет уже сохранённые узлы исключённых каталогов. Обычная работа после этого снова использует `force: false`.
- Канонический docs-store содержит `AGENTS.md`, индекс и принятые ADR, `docs/architecture/{code-map,design-system}.md`, актуальные документы `docs/engineering`, `docs/product/{vision,scope-v1}.md` и `docs/bugs/README.md`. Замороженные `docs/roadmap/{phases,tasks}.md` в семантический поиск не входят: текущий статус живёт в Task Master. После изменения проиндексированного документа повторить `codegraph_index_markdown`; устаревший источник удалить через `codegraph_remove_doc_source`.
- Результаты `hot_paths`, `find_circular_deps`, `find_entry_points`, complexity и impact являются подсказками. Они не заменяют TypeScript, `pnpm architecture`, тесты и чтение исходника: на baseline CodeGraph сообщал self-loop для `button.tsx`/`i18n.ts`, тогда как проверяемое правило dependency-cruiser `no-circular-dependencies` проходило. Не превращать эвристику CodeGraph в CI-гейт без независимого подтверждения.
- Task Master хранит состояние в `.taskmaster/config.json`, `.taskmaster/state.json` и `.taskmaster/tasks/tasks.json` (отслеживаются Git). Перед работой — `get_tasks` / `get_task` / `next_task`; затем `add_task` (ручные поля допустимы), `set_task_status`, при необходимости `add_subtask`. Во все вызовы передавать абсолютный `projectRoot`. Задачи, перенесённые из исторического `docs/roadmap/tasks.md`, ссылаются на FND-ID; автоматически парсить весь архив как PRD нельзя — это дублирует завершённые задачи и придумывает новые статусы. Текущие незакрытые ручные проверки перенесены в Task Master; старый файл остаётся историей.
- Инициализация выполнена без добавления npm-зависимостей и генерации OpenCode-команд. Модели в `.taskmaster/config.json` — шаблонные настройки генератора; в этом окружении `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `GOOGLE_API_KEY` не заданы, поэтому AI-операции (`parse_prd`, AI `add_task`, `expand_task`) не проверены и могут быть недоступны. Для них отдельно настроить поддерживаемую модель через `task-master.cmd models --set-main <model-id>` и предоставить ключ провайдера **в окружении процесса MCP**, а не в Git; для research — отдельную модель/ключ. После этого проверить AI-вызов на небольшой новой задаче и только затем применять его к проектным планам. В PowerShell использовать `task-master.cmd`: вызов `.ps1` может блокироваться execution policy.
- Если MCP-сервер недоступен в новом сеансе, проверить, что интеграции CodeGraph и Task Master активны в конфигурации OpenCode, корневой каталог открыт как workspace, а `.taskmaster/tasks/tasks.json` существует. Не создавать второй `opencode.json` с шаблонными ключами и не повторять `initialize_project` в уже инициализированном репозитории.

## Package manager

Проект использует закреплённую версию pnpm через Corepack. Global virtual store отключён в `pnpm-workspace.yaml`, чтобы структура `node_modules` была одинаковой в локальной разработке, Codex и CI.

## E2E runner

- `pnpm test:e2e` — сборка приложения и автоматический прогон Playwright против локального Electron; `playwright install` не требуется.
- `pnpm test:e2e:debug` — тот же прогон с Playwright Inspector.
- `pnpm test:e2e:report` — HTML-отчёт последнего прогона.
- Electron запускается дочерним процессом теста; при работе из OpenCode GUI-окна направляются через window-placement launcher.

## Интерактивная проверка Electron через MCP

- `electron-playwright` уже доступен в OpenCode как MCP. Для ручного smoke и отладки TJournal использовать его `connect` к работающему экземпляру с CDP-портом, затем `snapshot`, точечные действия и, когда нужно, `screenshot`/`evaluate`. Проверено на собранном приложении: подключение к `9222`, чтение дерева доступности onboarding, `Escape` и повторное чтение — блокирующий диалог не закрылся.
- Перед запуском отдельно собрать приложение (`pnpm.cmd build` в PowerShell). Запускать **видимое** окно через `C:\Users\PC\Documents\Programming\opencode-tools\tools\window-placement\Start-OnOtherScreen.cmd`, передавая Electron из зависимости `apps/desktop` с `--remote-debugging-port=9222` и собранный `apps/desktop/out/main/index.js`. Путь исполняемого Electron получать из установленной зависимости проекта, а не записывать его версию в MCP-конфигурацию. Если экземпляр уже запущен с CDP, повторно окно не запускать; подключаться к его фактическому порту.
- Для тестового экземпляра задавать `TJOURNAL_E2E=1` и `TJOURNAL_E2E_USER_DATA_DIR` внутри `C:\Users\PC\AppData\Local\Temp\opencode` до запуска, чтобы не использовать пользовательский vault. Заканчивая проверку через `connect`, вызывать `disconnect` (он не завершает приложение), затем закрывать только свой тестовый экземпляр. `close` в MCP применим к экземпляру, созданному через `launch`; этот способ не гарантирует запуск через window-placement launcher, поэтому для видимого окна использовать `connect`.
- Интерактивный MCP не заменяет `pnpm test:e2e`: стабильные регрессионные сценарии остаются в `test/e2e`, а MCP используется для наблюдения и проверки интерфейса в работающем Electron. Не направлять Electron UI-запросы в браузерный Playwright MCP.

## Architecture checks

- `pnpm architecture` прогоняет dependency-cruiser по `apps`, `modules`, `platform` и затем `test/architecture-fixtures/verify-guards.mjs`.
- Самопроверка сажает по одному нарушению на каждое правило: dependency-cruiser-правила круизятся по fixture-дереву, ESLint-правила (`window.tjournal`, `max-lines`) линтуются репозиторным `eslint.config.mjs` с fixture-корнем как base path. Новое правило без фикстуры не считается проверенным.

## Build artifacts

- `pnpm typecheck` (`tsc --build`) — единственный источник `.tsbuild` и `*.tsbuildinfo`; модули резолвятся через `exports` своих `package.json`, поэтому зависимости должны быть собраны раньше.
- `pnpm clean` (`tsc --build --clean`) — целевая очистка build-артефактов без удаления широких путей. Чистая проверка: `pnpm clean && pnpm typecheck`; она ловит пропущенные project references, которые stale `.tsbuild` может скрывать.
- Каждая project reference описывает реальный импорт `@tjournal/*`; при добавлении cross-module импорта сначала обновляется `tsconfig.json` модуля-потребителя.
- Ассеты иконки приложения лежат в `apps/desktop/resources`: `icon.ico` (кадры 16–256, `build.win.icon`) задаёт иконку exe, установщика, деинсталлятора и ярлыков, `icon.png` (1024) — мастер и иконка окна, `icons/icon-<size>.png` — набор 16–1024 из того же арта (обрезка по фигуре, поля 10% канвы). `resources` — public-каталог main-процесса electron-vite: `?asset`-импорт в `src/main/index.ts` резолвится в путь рядом с `out/`, поэтому `resources/icon.png` перечислен в `build.files`; без этой записи окно собранного приложения останется без иконки, а упаковка об этом не предупредит.

## Release verification

- `pnpm verify:release` выполняет локальный release-gate в фиксированном порядке: clean TypeScript build state, `pnpm check`, форматирование, Electron E2E и Windows NSIS build. Команда намеренно повторяет typecheck/build внутри составных команд: каждый публичный gate остаётся самодостаточным.
- GitHub Actions сохраняет отдельные шаги вместо одного вызова `verify:release`, чтобы по run было видно точное место сбоя. Успешная локальная команда не заменяет проверку тега, установку/обновление точного артефакта и сверку SHA-256 перед публикацией.

## Правила

- Предпочитать локальные инструменты, Git и тесты.
- Подключать внешний плагин только когда нужен доступ к конкретному сервису.
- Внешние данные валидировать как недоверенный ввод.
- Внешняя запись требует явного разрешения владельца.
- Плагины Codex не становятся зависимостями production-кода TJournal.
- Не передавать секреты или содержимое журнала внешним плагинам.
