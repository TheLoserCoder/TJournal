# ADR-0017: Account-scoped calculation ticks and bounded trade-detail columns

## Status

Accepted.

## Context

Two inconsistencies in the Trades workspace surfaced together:

1. Commission and spread already live on the account+instrument cost profile (`account_instrument_defaults`), but the tick size and tick value that the execution calculation needs were still edited on the global instrument profile (`instrument_calculation_profiles`). Editing an asset therefore controlled a number that is really a property of how an account trades that asset, and the asset table and filters exposed it as if it belonged to the instrument.
2. A trade can be created with full details (entry price, stop loss, lots, commission, spread, exits, notes, review status), but the journal table only exposed the values that fit the lean page row. Opening the table settings offered no columns for those details.

ADR-0013 keeps page rows lean and ADR-0016 keeps note contents out of page payloads, so simply loading the full aggregate per row is not an option.

## Decision

- Calculation ticks move to the account+instrument cost profile. `account_instrument_defaults` gains nullable `tick_size` and `tick_value_usd_per_lot`; migration `010-account-instrument-ticks` adds and backfills them from `instrument_calculation_profiles` for every existing cost-profile row so an already configured account keeps its calculated executions.
- Tick size and tick value are a pair: both set or both absent. Absent means the account has no calculated-execution profile for that asset. Commission and spread keep their existing required non-negative rules.
- `CreateTradeUseCase` resolves the execution profile from the account cost profile first and only falls back to the legacy instrument profile. The legacy table and its API stay readable for vaults that still rely on them; the asset editor no longer writes an instrument profile and the asset table and filters no longer expose ticks.
- The bounded journal page row gains a trade-detail projection: `entryPrice`, `stopLossPrice`, `quantityLots`, `commissionUsd`, `spreadTicks`, `exitCount`, `reviewStatus`, `hasEntryNote` and `hasReviewNote`. Exit counts come from one batched query per page, not a query per row; note contents and exit rows still require the point lookup.
- New detail filters are typed on `JournalTableFilters`: a per-column Decimal bounds record for the numeric details, a review-status multi-select and a note-presence multi-select. A page query with any trade-only detail filter excludes cash movements.
- New detail columns are hidden by default in both table modes and are enabled from the table settings. A saved layout predates them, so the table fills missing visibility and width entries from the column defaults instead of treating a missing key as visible.

## Consequences

- An asset edit no longer changes the calculation ticks of any trade; the account cost profile is the single edit point.
- Historical execution snapshots are untouched; migration only fills previously empty account cost rows.
- A page read costs one more prepared statement (the batched exit count), measured at 4.2 ms and 6 statements for 100 rows on a 5 000-row journal; the payload stays bounded and no note text crosses IPC.
- The Statistics page highlights no longer show one asset as both best and worst (see ADR-0010).
- The legacy `instrument_calculation_profiles` table and instrument-profile IPC remain as a fallback; removing them is a later cleanup once no vault depends on them.

## Alternatives considered

- Dropping `instrument_calculation_profiles` in the same migration — rejected: a vault that never opened the new account editor would lose its only calculation profile. The fallback keeps calculated executions working.
- Loading full executions for every page row — rejected: it reintroduces the unbounded payload ADR-0013 removed and ships note text that ADR-0016 keeps out of page DTOs.
- Reusing the existing instrument-profile UI and only relabelling it — rejected: the value would still be global per asset, which is the inconsistency being fixed.
- Client-side filtering of the loaded detail columns — rejected: filtering must stay consistent with server keyset pagination (ADR-0009).
