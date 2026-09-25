# ADR-0016: Qualitative trade journal notes and review status

## Status

Accepted.

## Context

Trade records currently preserve financial inputs, execution details, account snapshots and tag assignments, but have no place for the trader's entry rationale or post-trade review. Tags already represent setup and strategy taxonomy, so a second free-form strategy entity would duplicate that capability. The selected first slice is limited to text notes and a review status; binary attachments remain a separate follow-up.

## Decision

- Add nullable plain-text `entry_note` and `review_note` columns and a `review_status` column constrained to `unreviewed` or `reviewed`.
- Add migration `009-trade-notes-and-review`. Existing trades receive `unreviewed`; nullable note columns start empty. The normal pre-migration verified backup runs before this migration.
- Each note is limited to 4,000 Unicode code points. Domain validation owns this limit and normalization. Saving trims leading/trailing whitespace, maps whitespace-only input to `NULL`, and preserves internal whitespace and line breaks.
- Pure note normalization and length rules are exposed through the browser-safe `@tjournal/trade/note-rules` entry point so the renderer can display the domain limit without importing the Node-dependent trade root. Electron main, preload and shared runtime code import these rules from the compiled `@tjournal/trade` root, and the `main-process-must-use-compiled-module-entries` architecture guard rejects browser-safe TypeScript subpaths there.
- New trades default to `unreviewed`. A trader changes the status explicitly; entering or clearing `review_note` never changes it implicitly.
- Notes and review status are part of the persisted trade aggregate and every trade snapshot used by Undo/Redo. A notes-only or status-only edit must not rebind or recalculate the authoritative financial result or account snapshot.
- Notes are editable in trade details and creation details. The existing bounded journal `textQuery` matches a case-insensitive substring in the row identifier, entry note or review note. Unicode-aware lowercase matching runs in the SQLite adapter. Journal page DTOs do not return note contents; full notes are loaded only for the trade editor.
- Note contents are excluded from logs and safe error context. Boundary validation reports issue code/path, never the rejected text.
- Existing tags remain the setup/strategy taxonomy. Attachments, screenshots and a second strategy entity are outside this slice.

## Consequences

- The SQLite migration is additive and leaves financial snapshots, account attribution, tag assignments and execution data unchanged.
- The table search continues to use the existing bounded database read path; it does not load an unbounded trade dataset into the renderer.
- Backup and restore include notes automatically as part of the SQLite snapshot.
- The renderer keeps note drafts in the existing trade editor presenter and the View receives only values and callbacks.

## Alternatives considered

- Adding a separate strategy/setup field was rejected because current tags already serve that role.
- Automatically marking a trade reviewed when a review note is entered was rejected because note text and review completion are distinct facts.
- Attachments were deferred because their filesystem lifecycle, backup/restore behavior and Undo semantics require a separate design.
