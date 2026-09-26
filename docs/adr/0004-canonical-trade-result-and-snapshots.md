# ADR-0004: Canonical trade result and historical snapshots

## Status

Accepted.

## Decision

Every closed trade keeps the original quick-entry unit/value (`cash`, `percent`, or `r`) and one authoritative exact-decimal `netResultUsd`. USD input is already the final manual net result; percent input is converted from the account balance read at save time; R input is converted from the positive account-specific `1R, USD` value. A complete execution plus an instrument profile produces the authoritative net USD result from execution data. Financial arithmetic is implemented once in the trade domain with Decimal.

Calculated trades copy tick size and USD tick value per lot into the trade. Percent and R trades copy their conversion base/risk into the account attribution snapshot. Later changes to an instrument profile, account balance or account 1R therefore do not silently rewrite history. Account balances and USD statistics consume the saved USD result/snapshot and never reconvert an old entry against today's balance.

An explicit historical R rebind may update only unbound trades and trades bound to the previous vault default. New account-bound R entries use the account's remembered positive `1R, USD`; a successful explicit value replaces that account default only after the trade is saved. It runs together with the vault preference update in one SQLite transaction and one Undo/Redo command where applicable.

## Consequences

- USD, percent and R inputs are never summed as if they shared a unit: USD statistics use `netResultUsd`, while percent/R views use their original input only when the relevant saved value exists.
- New trades require a non-archived account. Legacy accountless entries remain readable and are excluded from complete account balances until explicitly assigned/resolved.
- Legacy trades retain their result and may have `direction = null`; every new or edited trade requires a direction.
- The inverse of a historical rebind restores only the risk-binding columns of the trades the rebind rewrote, captured before the update. It is not a full-journal trade snapshot: its cost is proportional to the rewritten rows, not to the journal, it cannot revert unrelated later edits to those trades, and a preference-only change does not invalidate trade-derived views.
- Renderer Views display validation codes and field paths but never receive SQLite messages or stack traces.
