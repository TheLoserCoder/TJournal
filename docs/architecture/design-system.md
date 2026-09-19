# Renderer design system

## Назначение

TJournal использует компактную профессиональную визуальную систему для desktop-рабочего места трейдера. Figma Dashboard (Community) является визуальным ориентиром для ритма, мягких поверхностей, скруглений, выравнивания и иерархии, но не является шаблоном контента: food-метрики, fake search, уведомления и `View report` не переносятся в приложение.

Редизайн renderer presentation layer не изменяет доменные правила, use cases, SQLite, IPC, preload API, gateway или presenter contracts.

## Граница ответственности

```text
feature View -> presentation primitives -> design tokens
       presenter/ViewModel callbacks       CSS theme mapping
```

`components/ui/*` отвечает за отображение, фокус, доступность, overlay и локальные visual states. Feature Views отвечают только за композицию своих ViewModel. Presenters сохраняют UI-state и callbacks. Domain/application/main process не импортируют design-system файлы.

## Слои токенов

Все значения находятся в CSS custom properties в `apps/desktop/src/renderer/styles/design-tokens.css`. Прямые цвета, тени, радиусы и размеры внутри feature styles запрещены.

### Reference tokens

Reference tokens — физическая шкала, которую можно заменить централизованно:

- `--ref-neutral-*`, `--ref-indigo-*`, `--ref-blue-*`, `--ref-violet-*`;
- `--ref-positive-*`, `--ref-negative-*`, `--ref-warning-*`;
- `--ref-space-*` с базовым шагом 4 px;
- `--ref-radius-*`, `--ref-shadow-*`, `--ref-duration-*`.
- Радиусы: `sm` 4 px для малых контролов, `md` 6 px для полей и кнопок, `lg` 10 px для поверхностей; pill используется только для компактных status badges.
- Тени остаются трёхуровневыми, но имеют малую непрозрачность: поверхность должна отделяться от canvas, а не выглядеть отдельным плавающим островом.

### Semantic tokens

Semantic tokens описывают смысл независимо от темы:

`--color-canvas`, `--color-surface`, `--color-surface-subtle`, `--color-surface-elevated`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-border`, `--color-border-strong`, `--color-accent`, `--color-focus`, `--color-positive`, `--color-negative`, `--color-warning`, `--color-info`, `--color-chart-primary`, `--color-chart-secondary`, `--color-chart-tertiary`.

### Component tokens

Component tokens связывают роль компонента с semantic tokens: `--button-primary-background`, `--button-secondary-accent-background`, `--button-accent-ghost-hover`, `--button-danger-background`, `--button-dismiss-background`, `--heading-page-foreground`, `--heading-section-foreground`, `--icon-default-foreground`, `--navigation-active-background`, `--input-border-focus`, `--table-header-background`, `--table-row-selected`, `--table-row-height`, `--dialog-background`, `--metric-background`.

Компонент не должен обращаться к `--ref-*` напрямую. Если существующей semantic/component роли недостаточно, сначала добавляется токен и документация, затем компонент.

## Темы

Light и Dark имеют самостоятельные mappings. Dark не является инверсией Light: значения проверяются отдельно на контраст, читаемость границ и визуальный вес.

- Light: холодный neutral canvas, белые surfaces, indigo accent, приглушённые positive/negative.
- Dark: сине-графитовый canvas, тёмно-синие surfaces, светлый indigo accent, более светлые, но не неоновые status colors.
- `Auto` использует системный `prefers-color-scheme` через существующий presenter/theme hook.

## Цветовая политика

- Indigo — основной action, активная навигация и focus.
- Blue и violet — вторичные аналитические серии и chart accents.
- Positive/negative — только финансовый результат, успешная/опасная операция и связанные состояния.
- Основная кнопка добавления использует тот же мягкий indigo treatment, что и активный пункт боковой навигации (`primary`). `secondary-accent` остаётся приглушённым violet-акцентом для вторичных действий, а `accent-ghost` — для действий без фоновой заливки.
- Успешное сохранение использует приглушённый positive tone. Обычный CTA не должен выглядеть как финансовая прибыль.
- Иконки закрытия и удаления всегда имеют красный/rose foreground, включая idle-state. Закрытие остаётся dismiss-ролью без красной заливки до hover/focus; удаление остаётся отдельной danger-ролью, с текстом и подтверждением для необратимого действия.
- Warning — неполные данные, legacy/uncovered состояние и требующие внимания предупреждения.
- Neutral — обычные данные, таблицы и вспомогательная информация.
- График использует фиксированный порядок indigo → blue → violet → neutral.
- Цвет не является единственным сигналом: сохраняются подписи, знак результата, иконка, граница, `aria-label` или tooltip.

## Компонентный каталог

| Компонент                  | Варианты и состояния                                                                 | Обязательные правила                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Button                     | primary, secondary, secondary-accent, accent-ghost, success, danger, ghost, disabled | min-height из token, reserved action space, focus-visible                                                     |
| IconButton                 | default, dismiss, edit, danger, disabled, hidden/reserved                            | localized `aria-label`, Tooltip, Lucide icon; close/delete foreground всегда red/rose                         |
| TextField                  | default, focus, invalid, disabled, numeric/date/time                                 | label/placeholder из i18n, tabular numbers для numeric                                                        |
| Select                     | closed, open, selected, disabled, invalid                                            | portal content, keyboard navigation                                                                           |
| Combobox                   | input, popup, highlighted, empty                                                     | popup не обрезается scroll container                                                                          |
| Checkbox                   | unchecked, checked, indeterminate, disabled                                          | visible focus, не полагаться только на цвет                                                                   |
| MultiSelect                | search, selected count, empty, clear                                                 | portal/filter panel, clear action                                                                             |
| Tooltip/HelpTooltip        | default, keyboard focus                                                              | вспомогательная информация, не единственный label                                                             |
| Popover                    | default, dialog layer                                                                | focus/dismissal принадлежат primitive                                                                         |
| Dialog/ConfirmDialog       | normal, destructive, validation                                                      | единый header/footer/focus trap                                                                               |
| DatePicker/DateRangePicker | single, range, empty, selected                                                       | locale-aware labels и portal                                                                                  |
| DirectionToggle            | long/short, active, keyboard focus                                                   | компактные L/S с directional arrow, `aria-pressed`, локализованные labels                                     |
| Badge                      | active, archived, warning, positive, negative, neutral                               | semantic tone + text                                                                                          |
| PageHeader                 | title, optional action area                                                          | общий alignment рабочей области                                                                               |
| Card/KPI                   | surface, elevated, positive, negative, neutral                                       | одна grouped summary surface; все KPI имеют единый размер числа и карточную геометрию, цвет только для смысла |
| Toolbar                    | quick entry, filters, selection actions                                              | reserved action area, no layout jump                                                                          |
| DataTable                  | header, sort, filter, resize, selected, empty                                        | compact rows, sticky header, keyboard focus                                                                   |
| State blocks               | error, validation, empty, unavailable                                                | shared spacing, border, icon and semantic role                                                                |

## Layout и responsive behavior

- Desktop shell: sidebar + minmax рабочая область.
- Общий horizontal alignment задаётся `.page-content > section`.
- Trades: heading → full-width grouped KPI summary → quick entry → filters/selection → table. Summary остаётся одной невысокой строкой на desktop и состоит из трёх смысловых групп с тонкими разделителями: финансы (`Итог`, `Учтённый баланс`), результативность (`Винрейт`, `Всего`, `Прибыльных`, `Убыточных`, `Безубыток`) и активы (`Лучший актив`, `Худший актив`). Все числовые KPI используют одинаковый размер; приоритет создают порядок, смысловой цвет и позиция, а не увеличенный кегль. Внешняя панель, quick-entry и таблица используют одинаковый компактный интервал между соседними блоками. Маркеры `#`, `$` и `%` дополняют подписи, но не заменяют их.
- Accounts & Assets: heading → tabs → toolbar → table → dialog.
- Settings: page header → surface cards → settings forms.
- При ширине до 960 px sidebar становится icon-first; подписи скрываются, но `aria-label` и tooltip сохраняются.
- При ширине до 720 px формы переходят в одну колонку, таблица сохраняет горизонтальную прокрутку.
- Overlay всегда рендерится через существующие portal-based primitives.
- Select, Combobox, Popover и DatePicker используют общую основу control/popup: одинаковые `md`-скругление, border, elevation и короткое появление через `data-state`. Внутри dialog они обязаны передавать `layer="dialog"`: portal popup получает `--overlay-z-dialog-popup`, то есть выше dialog content и overlay. При `prefers-reduced-motion: reduce` анимация не используется.
- Закрытие overlay является явным controlled-переходом: consumer применяет переданный `open`, а не инвертирует старое состояние. Это особенно важно для table filter popovers, где повторная инверсия вызывала мерцание и повторное открытие.
- `TimeField` является одним прямым редактируемым control с иконкой часов, без выпадающего меню: системный `input[type=time]` нельзя надёжно стилизовать, а отдельный popup для одного значения создаёт лишний шаг. Текстовое значение принимается только в `HH:mm`, а focus оформляется тем же ring и border, что у DatePicker.
- `DirectionToggle` используется в quick-entry и подробной сделке вместо Select для двух фиксированных вариантов: L/стрелка вверх-вправо и S/стрелка вниз-вправо. Состояние передаётся через `aria-pressed`, а полные локализованные названия остаются в `aria-label` и tooltip/title.
- Кнопка сброса календаря находится в его header-area рядом с навигацией месяца, а не в отдельной нижней строке. Это не увеличивает высоту календаря и оставляет action доступным с клавиатуры.
- При выборе строк Trades временно переключается в фиксированный selection toolbar и скрывает quick-entry. Accounts & Assets сохраняет зарезервированную высоту toolbar и не использует отрицательные отступы для selection actions.
- Close/dismiss сохраняет красную/rose иконку в idle-state и получает только мягкий rose фон на hover/focus; edit использует приглушённый blue/indigo state; danger зарезервирован для удаления и необратимых действий. Цвет иконки close/delete не заменяет локализованный `aria-label` и tooltip.
- Заголовки имеют три роли: page, section и card. Иконки наследуют semantic `currentColor`; серый цвет не задаётся отдельно в feature CSS.
- Строка таблицы имеет фиксированную высоту из `--table-row-height`. Выбор меняет только фон и внутренний outline, поэтому selected row не уменьшается.

## Правила разработки

1. Перед добавлением primitive проверить `components/ui/*` и существующие ViewModel/callbacks.
2. Не добавлять gateway, IPC, persistence, domain validation или history behavior в visual component.
3. Не добавлять пользовательские строки в JSX: использовать i18n keys.
4. Не создавать feature-local palette; новый визуальный смысл сначала получает token.
5. Не изменять presenter contract ради layout-only задачи.
6. Компонент должен иметь один основной responsibility и явные, intention-revealing props.
7. CSS-правила группируются по design-system layer, а не по случайному экрану.
8. Controlled account selection принадлежит workspace presenter. Reconciliation сохраняет текущий `account.id` выше remembered fallback и не конкурирует с обработчиком пользовательского выбора.
9. Account и Asset — разные сущности. Cost profile хранит только подсказки комиссии/спреда для комбинации счёт + глобальный актив; он не создаёт копию актива.

## Проверка

Для визуального изменения проверяются Light, Dark и Auto, все состояния компонентов из каталога, узкое окно, keyboard focus, `prefers-reduced-motion`, отсутствие clipping и layout jumps. Перед merge запускаются `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm architecture`, `pnpm format:check` и `pnpm build`.
