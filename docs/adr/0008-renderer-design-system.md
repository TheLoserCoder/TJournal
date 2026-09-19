# ADR-0008: Renderer design system with layered tokens

## Status

Accepted

## Context

Renderer уже содержит Radix/Base UI primitives и compact trade workspace, но стили исторически находятся в одном `styles.css`. В нём одновременно присутствуют ранние глобальные правила и FND-008/FND-009 tokens. Это усложняет смену палитры, поддержание Light/Dark и согласованную миграцию таблиц, форм, toolbar, dialogs и статистики.

Figma Dashboard (Community) нужен только как визуальный ориентир: спокойные поверхности, grid alignment, скруглённые контейнеры и аккуратная иерархия. Перенос содержимого dashboard не входит в решение.

## Decision

- CSS custom properties являются авторитетным источником design tokens.
- Токены имеют слои `reference -> semantic -> component`.
- Light и Dark задаются самостоятельными mappings; Dark не строится инверсией Light.
- Общее presentation поведение остаётся в renderer `components/ui/*`; feature Views получают только ViewModels и callbacks.
- Старые правила изолируются в CSS cascade layer `legacy`, новые tokens и presentation rules подключаются отдельными stylesheet layers.
- Цветовая система использует indigo как основной accent, blue/violet как chart accents, muted positive/negative для финансовой семантики и warning для неполных данных.
- Для обычного добавления используется основной indigo treatment, визуально связанный с active navigation. `secondary-accent` и `accent-ghost` являются двумя спокойными вторичными ролями без positive green; positive остаётся финансовым и success-смыслом. Иконки Close и delete всегда red/rose, но Close остаётся нейтральным dismiss-action без красной заливки в idle, а delete сохраняет danger-role и подтверждающие тексты.
- Радиусы ограничены 4/6/10 px, pill оставлен только для статусов; elevation снижена, чтобы поверхности не выглядели тяжёлыми островами.
- Trades имеют вертикальную композицию `PageHeader -> grouped KPI summary -> quick entry -> table`; summary занимает доступную ширину и на desktop остаётся одной невысокой строкой из трёх смысловых групп: финансы, результативность и активы. Группы разделяются тонкими линиями; все KPI используют одну карточную геометрию и один размер чисел, а финансовая семантика передаётся цветом текста и границы. Соседние блоки рабочей области разделяются одним компактным tokenized interval.
- Select, Combobox, Popover и DatePicker используют общую визуальную основу и одинаковое короткое overlay-появление с поддержкой reduced motion. `DirectionToggle` используется для двух фиксированных trade directions, а reset календаря находится в header-area.
- Overlay consumers используют булево controlled-состояние `open`; table filters не переключают состояние инверсией. Закрытие получает отдельную короткую exit-transition без изменения геометрии trigger.
- `TimeField` является одним прямым редактируемым control с иконкой часов и форматом `HH:mm`; отдельный native/portal picker не используется, потому что его системное меню нельзя привести к общей визуальной системе и оно вызывало нежелательные blur/state-переходы.
- DataTable передаёт selected state на `tr`; фиксированная высота строки и inset outline предотвращают layout shift при выборе.
- Trades при выделении строк показывает фиксированный selection toolbar и скрывает quick-entry; Accounts/Assets используют ту же зарезервированную высоту и не компенсируют её отрицательным margin.
- Account selection является controlled state workspace presenter: текущий выбор по `account.id` имеет приоритет над remembered localStorage fallback, чтобы reconciliation не создавала oscillation.
- Account form визуально отделяет account identity от account + global asset cost profiles. Это не меняет persistence contract в рамках FND-014.
- Dashboard content, новые analytics и функциональные изменения исключены.
- Renderer redesign не требует изменений domain/application/IPC/SQLite.

## Consequences

Смена палитры, темы, радиусов или плотности выполняется через tokens, без поиска по feature JSX. Новые primitives имеют единые accessibility и overlay rules. Legacy CSS можно удалять постепенно, когда все потребители подтверждены тестами.

Компонентные tests и manual Electron smoke становятся частью visual change acceptance. Feature CSS остаётся layout-only. Прямые цвета, локальные радиусы и тени считаются архитектурным нарушением.

## Alternatives considered

- Полная замена CSS одним новым файлом: отклонено из-за риска потерять существующие states и незавершённого рабочего дерева FND-010–013.
- Tailwind-only theme: отклонено, потому что primitives уже используют CSS variables и renderer должен иметь runtime Light/Dark mappings.
- Динамический пользовательский редактор палитры: отложено; сейчас нужна стабильная documented system palette.
