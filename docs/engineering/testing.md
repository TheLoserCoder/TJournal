# Стратегия тестирования

- Vitest: unit и integration tests (`apps/**/*.test.{ts,tsx}`, `modules/**`, `platform/**`).
- fast-check: свойства финансовых расчётов.
- React Testing Library: components and forms.
- Playwright: Electron end-to-end flows (`test/e2e/*.spec.ts`).
- axe-core: accessibility checks внутри существующей Electron-страницы.
- dependency-cruiser and ESLint boundaries: architecture rules.

Каждый найденный дефект получает regression test.

## Electron E2E

- `pnpm test:e2e` собирает приложение и запускает Playwright против локального Electron. Браузеры Playwright не скачиваются: используется Electron из workspace.
- Каждый сценарий получает изолированный `userData` и временный workspace; реальный vault и preferences пользователя недостижимы.
- Seams для выбора папки и `userData` включаются только при `TJOURNAL_E2E=1` (`main/e2e-environment.ts`); без флага переменные игнорируются, поэтому production-сборка их не использует.
- Локаль и тема приложения фиксируются через `preferences.json` тестового workspace, чтобы локаторы были детерминированными.
- Основной журнал покрывается через реальный UI; процентная конверсия, движения денег и аналитический отчёт проверяются через типизированный preload API в контексте renderer.
- Доступность проверяется axe-core, инжектированным в уже открытую страницу (Electron не позволяет открыть дополнительный browser context, а CSP страницы блокирует inline `<script>`). Перед сканированием ожидается завершение CSS-анимаций, иначе axe измеряет смешанные цвета fade-in и даёт ложные срабатывания контраста.
- Keyboard-проверки покрывают порядок Tab в toolbar, sidebar и таблице, редактирование выбранной строки и возврат фокуса на trigger после Escape.
- Артефакты падения: trace, screenshot, HTML-отчёт `playwright-report/`; временный workspace с JSONL-логами сохраняется, а его путь печатается в консоль. Успешный прогон удаляет workspace.
- Ручной визуальный smoke в Electron остаётся обязательным для редизайнов, overlay-изменений и новых адаптивных раскладок.
- Интерактивный smoke и отладку Electron выполнять через `electron-playwright` MCP: подключаться к экземпляру с CDP и отдельным тестовым `userData`, проверять accessibility snapshot и целевые действия; для видимого окна использовать window-placement launcher. Автоматическую регрессию сохранять в `test/e2e/*.spec.ts` и запускать через `pnpm test:e2e`. Подробности запуска и завершения сеанса — `docs/engineering/tooling.md`.
