# Renderer design system

## Назначение

TJournal использует компактную профессиональную визуальную систему для desktop-рабочего места трейдера. Референс `stitch_(2).zip` (Pro Trading Terminal) задаёт визуальный ориентир: тёмные многоуровневые поверхности, тонкие структурные линии, единый синий акцент действия, Inter для интерфейса и JetBrains Mono для чисел. Макеты не являются шаблоном контента: live-синхронизация брокера, открытые позиции, календарь событий, экспорт отчётов, Sharpe/Sortino и ROI не переносятся в приложение, потому что таких данных и функций в v1 нет.

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

- `--ref-neutral-*` — холодная нейтральная лестница Light-темы;
- `--ref-brand-*` — синяя ramp действия: `500` заливка, `600` читаемый текст, `ink` (`#ffffff`) белая подпись на заливке;
- `--ref-indigo-500`, `--ref-violet-500`, `--ref-teal-500`, `--ref-amber-500` — вторичные, info/edit, аналитические и четвёртая chart-роль;
- `--ref-dark-*` — самостоятельные поверхности, границы, текст, бренд, статусы и tag-пары Dark-темы;
- `--ref-positive-*`, `--ref-negative-*`, `--ref-warning-*` — финансовый и предупреждающий смысл;
- `--ref-space-*` с базовым шагом 4 px;
- `--ref-radius-*`, `--ref-shadow-*`, `--ref-duration-*`, `--ref-ease-*`;
- `--ref-font-sans` и `--ref-font-mono` — единственные семейства; `--ref-text-xs…2xl` — тексты шкалы.
- Радиусы: `sm` 4 px для малых контролов и чипов, `md` 6 px для полей, кнопок и метрик, `lg` 10 px для панелей и таблиц, `xl` 12 px для диалогов; pill используется для шкал, точек и компактных status badges.
- Тени остаются трёхуровневыми: в Light они почти незаметны, в Dark построены на чёрном цвете и отделяют overlay от canvas.
- Бинарные шрифты не поставляются: списки семейств начинаются с Inter и JetBrains Mono и деградируют до платформенных UI/monospace-шрифтов, поэтому offline-сборка не получает новых зависимостей.

### Semantic tokens

Semantic tokens описывают смысл независимо от темы:

`--color-canvas`, `--color-surface`, `--color-surface-subtle`, `--color-surface-elevated`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-border`, `--color-border-strong`, `--color-accent`, `--color-accent-hover`, `--color-accent-subtle`, `--color-accent-fill`, `--color-accent-ink`, `--color-focus`, `--color-positive`, `--color-positive-strong`, `--color-positive-subtle`, `--color-negative`, `--color-negative-strong`, `--color-negative-subtle`, `--color-warning`, `--color-warning-strong`, `--color-warning-subtle`, `--color-violet`, `--color-violet-subtle`, `--color-info`, `--color-info-subtle`, `--color-chart-primary`, `--color-chart-secondary`, `--color-chart-tertiary`, `--color-chart-quaternary`, `--color-overlay`.

Пара `--color-accent-fill`/`--color-accent-ink` гарантирует, что заполненная контролом-действием поверхность всегда читается: заливка не используется как цвет текста, а тёмная подпись не используется как заливка.

### Component tokens

Component tokens связывают роль компонента с semantic tokens: `--button-primary-background`, `--button-primary-background-hover`, `--button-primary-border`, `--button-primary-foreground`, `--button-secondary-background`, `--button-secondary-border`, `--button-secondary-foreground`, `--button-secondary-hover`, `--button-danger-background`, `--button-danger-border`, `--button-danger-foreground`, `--button-danger-hover`, `--button-dismiss-background`, `--button-dismiss-idle-background`, `--button-dismiss-idle-foreground`, `--button-edit-background`, `--button-edit-foreground`, `--button-accent-ghost-foreground`, `--button-accent-ghost-hover`, `--navigation-background`, `--navigation-item-foreground`, `--navigation-item-hover-background`, `--navigation-active-background`, `--navigation-active-foreground`, `--navigation-active-indicator`, `--heading-page-foreground`, `--heading-section-foreground`, `--heading-card-foreground`, `--icon-default-foreground`, `--icon-muted-foreground`, `--input-background`, `--input-border`, `--input-border-focus`, `--table-header-background`, `--table-row-hover`, `--table-row-selected`, `--table-row-selected-indicator`, `--table-row-height`, `--dialog-background`, `--dialog-border`, `--dialog-shadow`, `--metric-background`, `--metric-border`, `--metric-label-foreground`, `--meter-track-background`, `--meter-accent-background`, `--meter-positive-background`, `--meter-negative-background`, `--meter-neutral-background`, `--scrollbar-*`.

Компонент не должен обращаться к `--ref-*` напрямую, кроме радиусов, теней, длительностей, шрифтов и шкалы отступов. Если существующей semantic/component роли недостаточно, сначала добавляется токен и документация, затем компонент.

## Темы

Light и Dark имеют самостоятельные mappings. Dark не является инверсией Light: значения проверяются отдельно на контраст, читаемость границ и визуальный вес.

- Light: холодный neutral canvas, белые surfaces, синий текст действия (`--ref-brand-600`), приглушённые status colors.
- Dark: графитовый canvas `#0b0f17`, сине-графитовые surfaces `#111827`/`#161f30`, overlay-поверхность `#1b2434`, светлый синий акцентный текст `#60a5fa` и более светлые, но не неоновые status colors.
- Типографика: Inter для интерфейса, JetBrains Mono для чисел, дат, процентов и денежных значений; обе семьи деградируют до платформенных, бинарные шрифты не добавляются.
- `Auto` использует системный `prefers-color-scheme` через существующий presenter/theme hook.

## Цветовая политика

- Blue — единственный цвет действия: primary-кнопка, активная навигация, focus, выбранная строка, заполненный checkbox и кольцо винрейта. Indigo отвечает за edit/info, violet — за пополнение, warning — за вывод и неполные данные; синий акцент и indigo остаются разными ролями, чтобы действие не смешивалось с информацией.
- Positive/negative — только финансовый результат и подтверждённые положительные/опасные состояния. Обычная кнопка Save не использует positive tone.
- Белая подпись на синей заливке (`--color-accent-ink: var(--ref-brand-ink)`) выбрана как единственный вариант, который проходит контраст 4.5:1 для обычного текста кнопки в обеих темах.
- Тип записи имеет собственную палитру: long — зелёный (`--entry-type-long-*`), short — красный (`--entry-type-short-*`), пополнение — фиолетовый (`--entry-type-deposit-*`), вывод — жёлтый/warning (`--entry-type-withdrawal-*`). Пару разделяют `DirectionToggle` и badge колонки «Тип»; результат строки сохраняет отдельный финансовый tone.
- Иконки закрытия и удаления всегда имеют red/rose foreground, включая idle-state. Закрытие остаётся dismiss-ролью без красной заливки до hover/focus; удаление остаётся отдельной danger-ролью, с текстом и подтверждением для необратимого действия.
- Успешное сохранение — это `primary` (действие), а не зелёный: вариант `success` удалён, чтобы обычный CTA не читался как прибыль.
- Warning — неполные данные, legacy/uncovered состояние и требующие внимания предупреждения.
- Neutral — обычные данные, таблицы и вспомогательная информация.
- График использует фиксированный порядок blue → teal → violet → amber (`--color-chart-primary`…`--color-chart-quaternary`); положительные и отрицательные столбцы breakdown берут `--color-positive`/`--color-negative`.
- Цвет не является единственным сигналом: сохраняются подписи, знак результата, иконка, граница, `aria-label`, tooltip и точное числовое значение рядом со шкалой.

## Компонентный каталог

| Компонент                  | Варианты и состояния                                      | Обязательные правила                                                                                          |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Button                     | primary, secondary, accent-ghost, danger, ghost, disabled | Одна высота `--ui-control-height`, reserved action space, focus-visible; save/create/apply — только primary   |
| IconButton                 | default, dismiss, edit, danger, disabled, hidden/reserved | localized `aria-label`, Tooltip, Lucide icon; close/delete foreground всегда red/rose                         |
| TabList                    | active, hover, keyboard focus                             | единый вид переключения страниц: `aria-pressed`, accent underline, без feature-local кнопок вкладок           |
| TextField                  | default, focus, invalid, disabled, numeric/date/time      | label/placeholder из i18n, tabular numbers для numeric                                                        |
| Select                     | closed, open, selected, disabled, invalid                 | portal content, keyboard navigation, общий trigger с ChevronDown и accent-подсветкой                          |
| Combobox                   | input, popup, highlighted, empty                          | popup не обрезается scroll container                                                                          |
| Checkbox                   | unchecked, checked, indeterminate, disabled               | visible focus, тёмная галочка на accent-заливке, не полагаться только на цвет                                 |
| MultiSelect                | search, selected count, empty, clear                      | portal/filter panel, clear action, высота ограничена viewport                                                 |
| NumberFilter               | >, <, =, ><, invalid                                      | Decimal-предикат в presenter, обратный диапазон не применяется                                                |
| TextFilter                 | empty, filled                                             | регистронезависимый поиск, локальный reset только при значении                                                |
| DateTimeRange              | range, single day with time                               | UTC-границы, включительный диапазон                                                                           |
| Tooltip/HelpTooltip        | default, keyboard focus                                   | вспомогательная информация, не единственный label                                                             |
| Popover                    | default, dialog layer                                     | focus/dismissal принадлежат primitive                                                                         |
| Dialog/ConfirmDialog       | normal, destructive, validation                           | единый header/footer/focus trap, sticky chrome, tokenized scrollbar, подтверждение только primary или danger  |
| DatePicker/DateRangePicker | single, range, empty, selected                            | locale-aware labels и portal                                                                                  |
| DirectionToggle            | long/short, active, keyboard focus                        | компактные L/S с directional arrow, `aria-pressed`, локализованные labels                                     |
| Badge                      | active, archived, warning, positive, negative, neutral    | semantic tone + text                                                                                          |
| PageHeader                 | title, optional action area                               | общий alignment рабочей области                                                                               |
| Card/KPI                   | surface, elevated, positive, negative, neutral, accent    | одна grouped summary surface, mono-число, tone-граница слева, иконка и опциональное графическое дополнение    |
| Meter                      | accent, positive, negative, neutral                       | визуальное дополнение точного значения: `ui-meter` + `ui-meter-fill[data-tone]`, единственный сигнал запрещён |
| WinRateRing                | 0–100 %, пусто                                            | компактное conic-gradient кольцо одного `winRate`; точное значение и подпись рядом, кольцо decorative         |
| Toolbar                    | quick entry, filters, selection actions                   | reserved action area, no layout jump, fluid wrap without clipping                                             |
| DataTable                  | header, sort, filter, resize, selected, empty             | compact rows, sticky header, keyboard focus, local horizontal scroll                                          |
| State blocks               | error, validation, empty, unavailable                     | shared spacing, border, icon and semantic role                                                                |

## Владельцы стилей

| Файл                                      | Отвечает за                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `styles/design-tokens.css`                | Reference, semantic и component tokens, Light/Dark mappings                                       |
| `styles/design-system.css`                | Общие primitives, shell, forms, dialogs, Accounts/Assets, legacy-free presentation rules          |
| `styles/data-table.css`                   | Механика `DataTable`: scroll, sticky header, resize-guide, scrollbar, empty state                 |
| `features/journal/trades-page.css`        | Композиция Trades: workspace, quick-entry, selection toolbar, KPI summary и container queries     |
| `features/statistics/statistics-page.css` | Композиция Statistics: KPI tone-границы, шкалы, кольцо распределения, раскладка графика           |
| `components/charts/*`                     | Recharts-фасады (time series, breakdown), conic-gradient `ResultDistributionRing` и `WinRateRing` |
| `styles.css`                              | Сборка import-ов и изолированные legacy-правила в cascade layer `legacy`                          |

## Layout и responsive behavior

- Desktop shell: sidebar + minmax рабочая область. Shell занимает `100dvh`, не скроллится сам и передаёт вертикальную прокрутку `.page-content`. Навигация состоит из четырёх разделов — сделки, счета и активы, статистика, настройки; отдельной страницы «Главная» нет, при открытии приложение сразу показывает рабочее место сделок (`ApplicationPage` начинается с `trades`). Бренд приложения и кнопки Undo/Redo образуют одну строку `.sidebar-header` (при узком sidebar бренд сжимается до локализованного `TJ`), а иконка настроек везде одна — lucide `Settings`: в навигации, тулбарах таблиц и кнопке настроек быстрой статистики на странице сделок.
- Общий horizontal alignment задаётся `.page-content > section`. `.page-content` является контейнером адаптации (`container-type: inline-size`), поэтому feature-разметка реагирует на фактическую ширину рабочей области, а не на ширину окна.
- Trades: heading → full-width grouped KPI summary → quick entry → filters/selection → table. Summary состоит из трёх смысловых групп с тонкими разделителями: финансы (`Итог`, `Учтённый баланс`), результативность (`Винрейт`, `Всего`, `Прибыльных`, `Убыточных`, `Безубыток`) и активы (`Лучший актив`, `Худший актив`). Группы получают пропорцию по числу карточек (2 + 5 + 2), поэтому все девять карточек имеют одинаковую ширину и высоту, а не только совпадающий кегль значения; приоритет создают порядок, смысловой цвет, положение и графическое дополнение. Каждая карточка несёт локализованную подпись с тематической иконкой, а винрейт — компактное кольцо `WinRateRing` по доменному `winRate` рядом с точным процентом. Внешняя панель, quick-entry и таблица используют одинаковый компактный интервал между соседними блоками. Маркеры `#`, `$` и `%` дополняют подписи, но не заменяют их. Карточки KPI на странице статистики используют ту же метрическую лексику (`border-radius` `md`, отступ `--ref-space-2`, grid-подпись с иконкой и двухстрочным clamp, значение 1 rem), поэтому оба экрана читаются как одна система. Заголовки колонок таблиц не форсируют верхний регистр: регистр задаёт локализованная подпись.
- Summary остаётся одной невысокой строкой, пока рабочей области достаточно: ориентир — `72rem` контейнера. Ниже этого порога группа активов переносится целиком на отдельную строку, а settings сохраняет зарезервированный угол. Ниже `45rem` группы складываются вертикально, метрики внутри переходят в `repeat(auto-fit, minmax(7rem, 1fr))`, а тулбар quick-entry переходит на две колонки.
- Quick-entry и selection toolbar занимают одну grid-область и не удаляются из DOM: неактивный слой получает `data-active="false"`, `inert` и `aria-hidden`, поэтому переключение режима не меняет высоту рабочей области и не сдвигает таблицу. Оба слоя рендерятся всегда, включая пустой selection toolbar, который резервирует место.
- Quick-entry использует компактную однорядную композицию: пропорциональные колонки (`minmax` 3.5–6 rem) и группа действий справа. Все контролы имеют одну высоту `--ui-control-height`, включая `DirectionToggle` и autocomplete: они не добавляют собственный padding поверх базовой кнопки. Длинные названия счёта или актива сокращаются с ellipsis, а не переносятся во вторую строку. Колонка результата перевода в USD (`= 125,5 USD`) существует только при непустом `%`/`R`-превью: сетка получает `data-conversion="true"` и дополнительный трек, а без превью кнопка тегов следует сразу за выбором единицы, поэтому пустой калькулятор процентов/риска не оставляет разрыв. База процента показывается tooltip'ом на элементе конверсии, а не отдельной строкой под тулбаром. В режиме пополнения/вывода сетка сужается до трёх полей (`data-entry-kind="movement"`). Инлайн-поля 1R в тулбаре нет: значение задаётся в настройках вида таблицы. Начиная с контейнера 56 rem поля переносятся на трёхколоночную сетку, действия уходят в отдельную строку, а подпись `С деталями` заменяется компактной иконкой — так тулбар остаётся однородным вплоть до минимального окна.
- Accounts & Assets: heading → tabs → toolbar → table → dialog. Переключение счетов, активов и тегов использует общий `TabList` (`ui-tab-list`/`ui-tab` с `aria-pressed`), а не feature-local кнопки, поэтому все вкладки проекта выглядят одинаково.
- Statistics: heading → filter toolbar → optional coverage warning → grouped KPI row → performance chart card → breakdown chart/table card. Charts use the fixed analytics palette, keep equivalent tabular data available and reflow through `.page-content` container queries. Детализация ряда доступна в режимах `Авто/Час/День/Неделя/Месяц`; `Авто` показывает день по часам, для ограниченного периода ось непрерывна (день содержит все 24 часа, включая часы без сделок), а фактическая детализация возвращается в `effectiveRange.grain` и отображается отдельной строкой. Столбцы диаграмм ограничены `maxBarSize`, поэтому короткий ряд не растягивается в широкие блоки, а tooltip Recharts оформлен семантическими токенами (`--color-surface-elevated`, `--color-text-primary`), чтобы значение не сливалось с фоном в тёмной теме. Панель фильтров статистики использует единую компактную высоту контролов (`--ui-control-height-compact`) для селекта, мультиселектов и кнопки сброса, а кнопка сброса появляется только при активном фильтре. Селект периода и кнопка сброса получают модификатор `ui-control-compact` (primitive в `styles/design-system.css`), поэтому feature-CSS остаётся layout-only, а не переопределяет высоту примитива. `.statistics-page` держит `align-content: start`, как `trades-workspace`, `entities-workspace` и `settings-page`; заголовок страницы всегда прижат к верху, а строки грида не растягиваются, когда отчёт пуст.
- Settings: page header → surface cards → form rows. Страница настроек содержит только карточку «Интерфейс» (тема, язык) в двухколоночной сетке `.settings-fields-row`. Риск и расчёт инструментов редактируются там, где живёт сущность: 1R — в счёте/диалоге подсказки, tick size и tick value — в профиле расчёта счёта (account cost profile, ADR-0017); отдельные формы в настройках удалены.
- При ширине окна до 960 px sidebar становится icon-first; подписи скрываются, но `aria-label` и tooltip сохраняются.
- При контейнере до 45rem формы переходят в одну колонку, а таблица сохраняет горизонтальную прокрутку. Этот режим — заготовка мобильной версии: он проверяется zoom/devtools и не требует изменения минимального размера Electron-окна (960×640).
- DataTable получает ширину из `table.getTotalSize()`, поэтому сохранённые размеры колонок всегда создают локальную горизонтальную прокрутку вместо сжатия содержимого. Scroll-контейнер фокусируем (`role="region"`, `tabIndex=0`) и имеет локализованную подпись; sticky header и resize-guide остаются внутри него.
- Двойной клик по строке DataTable открывает диалог редактирования этой строки: сделка — подробную форму сделки, движение денег — редактор депозита/снятия, счёт — редактор счёта, актив — редактор актива. Действие передаётся в таблицу колбэком `onRowDoubleClick`; DataTable остаётся presentation-only и не знает о сущностях. Для клавиатуры и одиночного выбора остаётся кнопка «Изменить» в selection toolbar.
- Каждая data-колонка объявляет тип фильтра: текст, число, диапазон дат, диапазон даты/времени или множественный выбор. Панель показывает локальный сброс только при непустом значении, а кнопка сброса всех фильтров находится в тулбаре рабочей области слева от настроек вида и появляется лишь когда применён хотя бы один фильтр, поэтому таблица не сдвигается. Кроме того, у активного фильтра в заголовке колонки **слева от воронки** появляется своя компактная кнопка сброса — только для этой колонки. Режимы `>`/`<` строгие, `between` включительный, `=` — точное Decimal-равенство; обратный диапазон показывает локализованную ошибку и не применяется.
- Выпадающие списки Select, Combobox и панели фильтров ограничены доступной высотой viewport (`--radix-popper-available-height`, `--radix-select-content-available-height`, `--radix-popover-content-available-height`) и прокручиваются внутри себя, поэтому длинный список активов не выходит за экран. Combobox при открытии показывает весь список в переданном порядке (для активов — последние использованные сначала), даже если в поле уже есть значение; фильтрация включается только с реального набора текста, поэтому смена уже выбранного актива не требует сначала очищать поле.
- Колонка «Результат» показывает authoritative `netResultUsd`, а исходная единица `USD/%/R` остаётся отдельной колонкой. Числовой фильтр результата — одна компактная строка: символ режима (`>`/`<`/`=`/`><`), короткое поле суммы (валюта указана суффиксом `$` в плейсхолдере, отдельной подписи USD нет) и сброс; выбор единицы живёт в фильтре колонки «Единица». Строка без сохранённого USD (legacy `%/R`) отображается нейтральным «нет данных» и не пересчитывается по текущему балансу.
- Значение 1R задаётся в настройках вида таблицы («Вид таблицы» → 1R, USD) и применяется к R-сделкам выбранного счёта; после первой сохранённой R-сделки оно запоминается для счёта. Если при отправке R-сделки значение отсутствует и у счёта нет запомненного, открывается диалог ввода с подсказкой, где искать настройку позже.
- Порядок колонок таблицы сделок задаёт конфигурация: `DEFAULT_TRADE_TABLE_COLUMNS` перечисляет `Результат → Актив → Теги → Тип → Счёт → Дата`, затем скрытые «Тип актива», «Дата и время», «Единица», «Идентификатор» и детали сделки («Цена входа», «Стоп-лосс», «Лоты», «Комиссия», «Спред», «Выходы», «Review status», «Заметки»). Детали видны в advanced-режиме и включаются из настроек вида; сохранённый layout, созданный до их появления, получает для новых колонок их дефолтную видимость и ширину, а не считается видимым. Колонка «Теги» показывает цветные метки из палитры `--tag-<color>-*`, сворачивает непоместившиеся в кнопку `+N` с portal-popover и имеет multi-select фильтр с опцией «Без тегов». Палитра тегов — десять мягких ролей (`indigo, blue, cyan, teal, olive, amber, orange, rose, violet, slate`), по паре reference/component токенов на цвет в Light и Dark; цвет идентифицируется токеном, а не произвольным HEX. «Тип актива» — категория инструмента (`forex`, `crypto`, …) с локализованной подписью и multi-select фильтром; по умолчанию колонка скрыта в компактном режиме и включается в настройках вида таблицы. В таблице нет drag-сортировки колонок, поэтому сохранённый порядок не применяется: `normalizeTradeTableColumnOrder` всегда возвращает канонический. Сохранённые ширины и видимость колонок остаются пользовательскими, поэтому «Счёт» включается в компактном режиме по умолчанию, но сохранённый вид может его скрывать.
- Quick-entry не создаёт актив из пустого поля: кнопка «Добавить» выключена, пока символ актива или результат сделки (сумма движения для пополнения/вывода) пусты, а неизвестный символ открывает диалог создания актива с выбором типа (`AssetCreateDialogView`). Новый актив больше не создаётся молча как `forex`. Кнопка «С деталями» остаётся независимой, потому что открывает собственную форму.
- Колонки таблицы сужаются до компактных минимумов (сделки — 48 px, сущности — 56 px): ячейки имеют `box-sizing: border-box`, а содержимое обрезается ellipsis и не распирает колонку.
- Рабочая область использует компактные боковые отступы `clamp(0.75rem, 1.5vw, 1.25rem)` и широкий предел контента (`110rem`), поэтому таблица занимает почти всю ширину окна. Зарезервированная высота таблицы минимальна (`--table-viewport-min-height` 6 rem, пустое состояние 5 rem): таблица растёт по содержимому, а не занимает пустую площадь при нескольких строках.
- Тулбар quick-entry задаёт ширину контролов своими grid-треками, а не собственными `min-width` полей: треки полей типа записи, счёта, актива и результата ограничены сверху (примерно на 20% компактнее), а группа действий прижата к правому краю. Сброс всех фильтров и кнопка настроек вида (иконка шестерёнки, `Settings`) собраны в общий блок `.table-toolbar-actions`, который прижат к правому краю тулбара над таблицей и не двигается при переключении слоя ввода/выделения. Таблица занимает всю ширину рабочей области и сохраняет локальную горизонтальную прокрутку только когда сумма размеров колонок больше контейнера.
- Overlay всегда рендерится через существующие portal-based primitives.
- Select, Combobox, Popover и DatePicker используют общую основу control/popup: одинаковые `md`-скругление, border, elevation и короткое появление через `data-state`. Внутри dialog они обязаны передавать `layer="dialog"`: portal popup получает `--overlay-z-dialog-popup`, то есть выше dialog content и overlay. `Tooltip` и `HelpTooltip` используют ту же тематическую поверхность `--color-surface-elevated` с border и shadow, поэтому подсказки не инвертируют палитру и одинаково читаются в Light и Dark. При `prefers-reduced-motion: reduce` анимация не используется.
- Закрытие overlay является явным controlled-переходом: consumer применяет переданный `open`, а не инвертирует старое состояние. Это особенно важно для table filter popovers, где повторная инверсия вызывала мерцание и повторное открытие.
- `TimeField` является одним прямым редактируемым control с иконкой часов, без выпадающего меню: системный `input[type=time]` нельзя надёжно стилизовать, а отдельный popup для одного значения создаёт лишний шаг. Текстовое значение принимается только в `HH:mm`, а focus оформляется тем же ring и border, что у DatePicker.
- `DirectionToggle` используется в quick-entry и подробной сделке вместо Select для двух фиксированных вариантов: L/стрелка вверх-вправо и S/стрелка вниз-вправо. Состояние передаётся через `aria-pressed`, а полные локализованные названия остаются в `aria-label` и tooltip/title.
- Кнопка сброса календаря находится в его header-area рядом с навигацией месяца, а не в отдельной нижней строке. Это не увеличивает высоту календаря и оставляет action доступным с клавиатуры.
- При выборе строк Trades временно переключается в фиксированный selection toolbar и скрывает quick-entry. Accounts & Assets сохраняет зарезервированную высоту toolbar и не использует отрицательные отступы для selection actions.
- Close/dismiss сохраняет красную/rose иконку в idle-state и получает только мягкий rose фон на hover/focus; edit использует приглушённый blue/indigo state; danger зарезервирован для удаления и необратимых действий. Цвет иконки close/delete не заменяет локализованный `aria-label` и tooltip.
- Заголовки имеют три роли: page, section и card. Иконки наследуют semantic `currentColor`; серый цвет не задаётся отдельно в feature CSS.
- Строка таблицы имеет фиксированную высоту из `--table-row-height`. Выбор меняет только фон и внутренний outline, поэтому selected row не уменьшается.
- Выходы сделки отображаются как мини-таблица: общий шаблон колонок `--trade-exit-columns` для заголовка и строк, глобальный селектор объёма (`% позиции` / лоты) в заголовке блока, ручной результат — одно поле без выбора единицы. Это presentation-only: домен по-прежнему хранит `reportedResultKind` и `allocationKind`.
- Профиль комиссий и спреда счёта — такая же мини-таблица из четырёх колонок (актив, комиссия, спред, удаление). Строки не пересекаются, потому что контролы не распирают треки (`min-width: 0` у полей и autocomplete-группы), а диалог счёта имеет собственную ширину (`account-editor-dialog`). Поле актива — Combobox с вводом: можно и набирать символ, и выбирать из списка последних активов. Редакторы счёта и актива живут в `account-asset-editor-dialogs.tsx` на уровне рабочего места, поэтому их состояние не привязано к активной странице.
- Горизонтальная прокрутка таблицы оформляется токенами `--scrollbar-*`, поэтому она заметна в Light и Dark, а не выглядит системным артефактом.
- Скроллбары страницы, диалогов, Select/Combobox/Popover, списков тегов и областей статистики используют те же `--scrollbar-*` (`scrollbar-width: thin` и тонкий `::-webkit-scrollbar-thumb` с прозрачным треком), поэтому системный скролл не остаётся ни в одном прокручиваемом контейнере.
- Диалог владеет собственным padding-ом и chrome: `.ui-dialog-header` и `.ui-dialog-actions` закреплены (`position: sticky`) и растянуты на всю ширину диалога отрицательными inline-отступами, поэтому заголовок и кнопки остаются видимыми, а прокручивается только тело. Действия диалога идут одним порядком: отмена (secondary) → подтверждение (primary) или удаление (danger).
- Числовые readout-ы моноширинны и выровнены: `.ui-numeric` применяется к result-чипам, значениям KPI-карточек, метрикам сводки сделок и числовым колонкам статистики; ячейки `DataTable` получают `font-variant-numeric: tabular-nums`.
- Страница статистики показывает проценты совместимыми способами: карточка винрейта в KPI несёт то же кольцо `WinRateRing`, что и сводка сделок (точный процент рядом), кольцо распределения результатов (`ResultDistributionRing`, conic-gradient из `winningTrades/losingTrades/neutralTrades`) и цветные столбцы breakdown (positive/negative по знаку `netResultUsd`). Сводка сделок дублирует винрейт компактным кольцом `WinRateRing` по доменному `winRate` рядом с точным процентом. Рядом с любой шкалой всегда стоит точное значение, а отсутствующие данные показываются как «нет данных», а не как ноль.
- Тулбар статистики держит фильтры, затем `statistics-performance-layout` делит карточку производительности на график и кольцо; ниже контейнера `72rem` кольцо переносится под график, а KPI-сетка переходит в три, затем в две колонки.
- Адаптивные пороги Trades задаются container queries, а не viewport media queries: один и тот же размер окна даёт разную рабочую ширину при раскрытом и компактном sidebar.

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
10. Одна роль для одного действия: подтверждение — `primary`, удаление — `danger`, отмена — `secondary`; новый вариант кнопки не добавляется, пока его не использует минимум один реальный экран.
11. Переключение вида внутри страницы выполняется только через `TabList`; прямые `<select>` и локальные списки-кнопки в feature-разметке запрещены — используется `Select`/`Combobox`/`TabList` из `components/ui/*`.
12. Процент или доля показывается шкалой `ui-meter`/кольцом и обязательно дублируется точным числовым значением и подписью.

## Проверка

Для визуального изменения проверяются Light, Dark и Auto, все состояния компонентов из каталога, узкое окно, keyboard focus, `prefers-reduced-motion`, отсутствие clipping и layout jumps. Перед merge запускаются `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm architecture`, `pnpm format:check` и `pnpm build`.

Обязательный визуальный проход FND-028:

- окна 1600×900, 1280×800, 1100×800 и минимальные 960×640, дополнительно 800×700 и 620×700 через zoom/devtools;
- документ и `.page-content` не имеют горизонтального overflow, таблица прокручивается локально, popup не обрезается краем окна;
- длинный диалог (подробности сделки, счёт, актив, тег) сохраняет заголовок и футер, прокручивается только тело, скроллбар виден и в Light, и в Dark;
- контраст проверяется для заполненной primary-кнопки (белая подпись на синей заливке), muted-текста, tooltip, selected row и линий графиков; axe-сканирование остаётся без serious/critical;
- шкалы и кольцо процентов всегда сопровождаются точным значением.
