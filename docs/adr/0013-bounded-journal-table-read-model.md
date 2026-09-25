# ADR-0013: Bounded journal table read model

## Status

Accepted. Stage 1 (read model and adapter) and stage 2 (renderer switch, route removal and virtualization) are implemented.

## Context

The Trades workspace loaded every trade and every cash movement through `trades.list`, mapped complete DTOs in the main process and filtered, sorted and rendered the full list in the renderer. The journal is unbounded by design, so memory, IPC payload and DOM size grew linearly with history. ADR-0005 and the analytics report already bound their outputs; the table needed the same treatment.

## Decision

- `modules/trade` owns the `JournalTableReader` port and its row DTOs. The trades journal owns the merged table contract; a cash-movement row is a consumer-owned read DTO (`JournalTableMovementRow`) so the contract does not depend on the account module.
- Filters and allowlisted sorts execute in SQLite. The allowlist is `date`, `result`, `asset`, `type`, `account`; each sort has deterministic tie-breakers (null-last rank columns and `id`).
- Result bounds are compared with exact Decimal semantics through the registered `tjournal_decimal_cmp` SQLite function. `CAST(... AS REAL)` is allowed only as an ordering key; stored and displayed money remain exact decimal strings.
- Pagination is bidirectional keyset. The opaque base64url cursor records the sort field, direction, traversal (`after`/`before`) and key values; it is validated on decode and rejected with a `validation-invalid` safe error when malformed or used with a different sort. Page size is capped at `MAX_JOURNAL_TABLE_PAGE_SIZE` (200).
- Filter semantics mirror the existing table predicates one-to-one: prefixed identifier text search, entry kinds, asset and category selection, account with unassigned option, UTC date ranges, inclusive instant ranges, input result units, tag selection with the untagged option, and exact result bounds.
- The default order is `occurred_at DESC`, trade rows before movement rows at the same instant, then `id`.

## Consequences

- A page read costs one indexed scan plus lightweight batch trade mapping: measured 3.9 ms and 5 prepared statements for 100 rows on a 5 000-row journal.
- The renderer loads pages of 100 rows and retains at most three pages. It requests the adjacent page near either retained boundary; absolute virtual row indexes and spacer rows preserve scroll geometry when the far page is evicted. Before the container is measured the table renders a bounded retained window, so the surface is never blank.
- Selection and bulk deletion apply to loaded rows only; the select-all label says so explicitly.
- The catalogue's trade counts come from a dedicated `tags:counts` read route, and the table reloads itself from the committed-change version instead of a presenter-owned trade list.
- The previous unbounded `trades.list` route is removed from IPC, preload, gateway and DTOs; a renderer cannot request the whole journal any more.
- Journal page trade rows omit execution/exits. Opening the editor loads the complete aggregate through the bounded `trades:get` point route.
- The reader is synchronous like the rest of the database layer; the IPC boundary keeps it off the renderer thread.

## Alternatives considered

- A separate `journal-table` module — deferred: the row contract is small and the trades journal is its natural owner; a new module would add workspace wiring without a second consumer.
- Filtering in the main process over streamed rows — rejected for this slice: the plan requires filters to run in SQLite, and Decimal bounds are available there through the registered comparator.
- OFFSET pagination — rejected: deep offsets scan and discard growing prefixes and are unstable under concurrent writes.
- Loading full exits for every page row — rejected: exits are only needed when the details editor opens; the point lookup already exists for that path.
