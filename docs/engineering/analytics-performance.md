# Analytics report performance

## Baseline

Дата измерения: 2026-09-20. Среда: локальный Windows development build, Node 24, `node:sqlite`, synthetic vault со 100 000 закрытых сделок, 8 инструментами разных категорий, одного счёта и 14 285 сделок в годовом диапазоне (2026).

Первый замер до исправления SQL: один инструмент, без account attribution. Второй замер на итоговом adapter: 8 инструментов, назначенный счёт, snapshot полей. Итоговые числа выше первого замера и считаются актуальными.

| Path                                              |    Rows |  Duration |
| ------------------------------------------------- | ------: | --------: |
| Streaming scan, all time (итоговый adapter)       | 100 000 | 677.80 ms |
| Streaming scan, one-year range (итоговый adapter) |  14 285 |  93.34 ms |
| Full report, instrument breakdown, all time       | 100 000 |  1 959 ms |
| Full report, instrument breakdown, one-year       |  14 285 |    253 ms |
| Full report, account breakdown, all time          | 100 000 |  2 807 ms |
| Full report, day grain, all time                  | 100 000 |  1 906 ms |

Полный отчёт включает sequential streaming scans: chronological (KPI + time series), выбранный breakdown dimension и, если dimension не instrument, отдельный instrument scan для best/worst. Отчёт исполняется в read-only Piscina worker и не блокирует Electron main/renderer; renderer получает bounded DTO и показывает старые данные с `aria-busy` во время refresh.

Первый запуск на 100 000 сделках — секунды, а не миллисекунды. Это принятый обмен памяти на чтение: три прохода по индексу вместо загрузки массива сделок, как это делает legacy quick summary. Если появится реальная жалоба на время отклика, сначала измерять конкретный сценарий и оптимизировать (например, индекс `(instrument_id, closed_at)`), а не менять формулы.

## Coarsening

`auto`/явно выбранная детализация укрупняется во время единственного streaming scan до `hour -> day -> week -> month -> year`, пока число buckets не уложится в 400. `auto` выбирает часовую детализацию для диапазона в пределах двух суток, поэтому выбранный день показывается по часам, а не одной точкой. Для ограниченного диапазона каждый bucket предзаполняется, поэтому пустые часы и дни остаются на оси (24 часа за день); если диапазон на выбранной детализации превышает бюджет в 400 точек, предзаполнение пропускается и остаются только buckets со сделками. `effectiveRange.grain` возвращает фактическую детализацию, renderer показывает её пользователю. Это не меняет KPI и не требует повторного чтения SQLite.

## Query plan

One-year range:

```text
SEARCH trades USING INDEX trades_closed_at_idx (closed_at>? AND closed_at<?)
SEARCH instruments USING COVERING INDEX sqlite_autoindex_instruments_1 (id=?)
```

Range + direction filter + grouping order:

```text
SEARCH trades USING INDEX trades_closed_at_idx (closed_at>? AND closed_at<?)
SEARCH instruments USING COVERING INDEX sqlite_autoindex_instruments_1 (id=?)
USE TEMP B-TREE FOR ORDER BY
```

Новый индекс не добавлен: существующий `trades_closed_at_idx` обслуживает селективный диапазон, а группировки отсортированы по индексируемому ключу с временным B-tree только для filtered варианта. Повторно измерять при изменении query shape; индекс без измеримого улучшения не сохранять.

## Budgets

- renderer response: не более 400 series points и 50 breakdown rows; very long ranges may be grouped by year;
- никакого массива всех trades в новом report path;
- chart library должна находиться в отдельном lazy renderer chunk;
- stale worker result не применяется после новой ревизии или смены vault;
- повторить замер после изменения SQL, индексов или формул отчёта.
