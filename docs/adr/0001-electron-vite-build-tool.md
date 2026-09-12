# ADR 0001: Сборка desktop-приложения через electron-vite

## Контекст

Первоначально для desktop-shell рассматривался Electron Forge. В рабочей среде его дерево зависимостей требует git-подзависимость `@electron/node-gyp`, которую политика менеджера пакетов не разрешает установить. Это блокирует воспроизводимую установку проекта, не давая продуктовой ценности.

## Решение

Используем `electron-vite` для разработки и production-сборки, а `electron-builder` — для упаковки Windows-инсталлятора. Electron, React, TypeScript и границы main/preload/renderer не меняются.

## Последствия

- Команды разработки: `pnpm dev`, `pnpm build`, `pnpm package`, `pnpm make`.
- Конфигурация сборки находится рядом с desktop-shell: `apps/desktop/electron.vite.config.ts` и `apps/desktop/package.json`.
- Изоляция renderer, preload и IPC-граница остаются обязательными.

## Альтернативы

- Electron Forge: отклонён на текущем этапе из-за неустанавливаемой подзависимости.
- Tauri: не выбран, так как увеличивает технологический разрыв с будущими Node/TypeScript-адаптерами без текущей выгоды.
