# ADR-0009: Typed table column filters and the unified USD result column

## Status

Accepted

## Context

Every work table (Trades, Accounts, Assets) rendered its own ad-hoc filter set. Column filters existed only for a subset of columns, cash movements were filtered by a second predicate that did not follow the trade filters, and colour semantics for long/short/deposit/withdrawal were spread between the toggle and table badges. An added column could therefore appear without any filter and without a colour role, and the analytics summary could disagree with the visible rows.

ADR-0004 already established one authoritative exact-decimal `netResultUsd` per trade, but the table displayed the original input `resultValue` with its unit and sorted mixed units as if they were comparable.

## Decision

- Every data column declares a filter schema (`text`, `number`, `date-range`, `datetime-range`, `multi-select`, or explicit `none` for mechanical columns). The schema map is annotated with the exhaustive column-id union, so a new column without a declared filter is a type-check error; a companion test asserts that the map covers every data column and that `none` is never used for data.
- `DataTable` stays a mechanical view. It receives filter view models, an optional global reset view model and renders shared presentation panels. All predicates and state live in feature presenters.
- One predicate filters the merged journal rows, so trades and cash movements can no longer be filtered by divergent rules. Percent/R rows without a saved USD snapshot match no numeric USD filter and are displayed as unavailable instead of being rebased on today's balance.
- Numeric comparisons use `Decimal`. `>`/`<` are strict, `between` is inclusive, `=` is an exact match; an inverted range is reported in the panel and never applied. The number panel is a single row: a symbol-sized mode selector, the value field and an inline reset.
- The Result column displays, sorts and filters by `netResultUsd`; the original quick-entry unit stays a separate column and its own filter. Deposit rows show a positive USD amount and withdrawal rows a negative one.
- The 1R default is a functional field of the table settings dialog and applies to R trades of the selected account; after the first saved R trade it is remembered for the account. Submitting an R trade with no value opens an input dialog that tells the user where to find the setting later.
- Entry type colour has one component-token pair per type: long green, short red, deposit violet, withdrawal yellow/warning. The direction toggle and the table badge read the same tokens. Financial result tone (`positive`/`negative`/`neutral`) remains a separate semantic used only for the result.
- A global reset lives in the workspace toolbar left of the view settings and appears only while at least one filter is applied; each panel also resets its own filter and hides that action at its default value. In addition, an active column shows its own compact reset left of the funnel in the header, so one filter can be cleared without opening its panel. The action therefore never shifts or narrows the table.
- Every column header highlights only when its own filter is applied.
- Analytics receives typed filter fields (`entryKinds`, `resultUnits`, `netResultBounds`, `textQuery`) through the existing `data:changed` request pipeline. Persistence, IPC routes, SQLite schema and application settings are unchanged; filters remain session-only.

## Consequences

- Popup lists are bounded by the space left in the viewport and scroll internally, so a long asset list can no longer extend past the window.
- Adding a column requires a schema entry, a predicate branch, a layout default and a colour role where relevant; the type system and tests fail otherwise.
- Saved views and persisted filter presets remain a separate roadmap item because filters intentionally stay in presenter state.
- The summary can follow table filters field-by-field; criteria without a domain representation are not applied to analytics, so `Follow table filters` remains an approximation documented in the settings dialog.
