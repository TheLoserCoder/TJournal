# ADR-0007: Account attribution and derived balances

## Status

Implemented in FND-012.

## Context

Every new trade and cash movement belongs to a vault-scoped non-archived account. A mutable balance field would make edits, backdating, and Undo/Redo ambiguous. Account defaults must help entry without rewriting historical facts. Existing accountless history is retained as an explicit migration concern rather than silently assigned.

## Decision

- `modules/account` owns account validation, lifecycle, account/instrument defaults, and the balance read model. It does not import the trade aggregate or SQLite.
- An account stores its normalized name, opening USD balance, lifecycle timestamps, and a remembered positive `defaultRiskUsd`. Current known balance is derived as `openingBalanceUsd + sum(persisted trade USD impacts) + deposits - withdrawals`.
- On trade save, the application reads the account's current known balance and persists an immutable attribution snapshot: account id/name, balance before, authoritative USD impact, conversion kind, and the percent base or initial risk when applicable. Calculations use the Decimal boundary and are shared by create/update/preview paths.
- USD input is final net USD; percent input uses the positive balance snapshot; R input uses the positive account-specific `1R, USD` snapshot. Ordinary trades may make the accounted balance negative, but percent input is blocked at zero or below.
- Editing a trade recalculates only when its financial input or account is explicitly changed. Metadata-only edits preserve the saved USD result and conversion snapshot. It never rebases other trades by `closedAt`; changing opening balance or the account default likewise does not rewrite snapshots.
- Deposits and withdrawals are separate cash-movement records. A withdrawal amount is strictly positive, its sign is derived from its kind, and validation plus persistence are atomic. It cannot exceed the current known balance or proceed while unresolved legacy impacts make that balance incomplete.
- Account and instrument deletion archives referenced rows and physically deletes only unreferenced rows. Restore and all mutations are history commands. Historical account and instrument name/symbol snapshots remain unchanged after rename.
- Account/instrument defaults are entry-time suggestions only. They never silently deduct from manual quick-entry cash results or modify persisted trades.

## Consequences

The UI can show trading P&L separately from the accounted balance and uncovered-trade count without claiming that a partial projection is complete. Undo restores exact persisted snapshots and cash movements. Deposits, withdrawals, transfers, multi-currency conversion, broker synchronization, and history-wide rebasing remain outside this slice.
