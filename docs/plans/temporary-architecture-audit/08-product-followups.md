# Temporary plan 08 — Product follow-ups after hardening

## Purpose

Convert the audit's product suggestions into independent roadmap-ready slices. This file is not authorization to implement all features together. The owner must select one slice, and the executor must create a permanent roadmap task/ADR where required before writing feature code.

Do not start this plan until plans 01–07 are complete or the owner explicitly reprioritizes with awareness of the remaining integrity/recovery risk.

## Priority order

1. Qualitative trade journal: setup, notes and review.
2. Tag analytics.
3. CSV import with dry-run and deduplication.
4. Saved views and recurring review.

Each slice is a separate implementation task and should be handled by a separate agent/session.

---

## Slice A — Qualitative trade journal

### User outcome

A trader can record why a trade was taken, the setup followed, mistakes/emotions, and post-trade review—not only numeric result. This turns TJournal from a transaction tracker into a learning journal.

### Initial scope

- Optional plain-text `entryNote` and `reviewNote` with explicit length limits.
- Optional structured review status: `unreviewed` / `reviewed`.
- Existing tags remain the strategy/setup taxonomy; do not add a second free-form strategy entity in the first slice.
- Notes editable in trade details and searchable from the trade table.
- Notes excluded from logs and safe error context.

Screenshots/attachments are a second sub-slice after text notes. Do not combine binary attachment lifecycle with the first schema change.

### Ownership and contracts

- Trade aggregate owns immutable/persisted note fields and review status.
- Trade validation owns limits and normalization.
- Trade store migration adds nullable/defaulted columns without rebasing financial snapshots.
- Typed IPC schemas validate external text.
- Renderer presenter owns drafts; View only renders fields/callbacks.
- Analytics ignores notes unless a later explicit metric is designed.

### Required tests

- Create/update notes without changing authoritative USD result or account snapshot.
- Maximum length and Unicode.
- Search finds notes but does not expose them in logs.
- Undo/Redo restores exact note/review snapshot.
- Legacy trades load with empty notes/unreviewed status.
- E2E edit, restart and search.

### Attachment follow-up

After notes ship, design attachments with:

- content hash and metadata in SQLite;
- bytes under vault `attachments/`;
- allowed MIME/size limits;
- collision-safe names independent of user filename;
- atomic add/remove plus Undo semantics;
- backup/restore integration;
- no renderer arbitrary filesystem paths.

A dedicated ADR is mandatory before attachment implementation.

---

## Slice B — Tag analytics

### User outcome

The Statistics page can answer which strategies/setups/mistakes, represented by tags, are profitable or harmful.

### Scope

- Tag multi-select filter with OR-within-tag semantics initially.
- Optional “untagged” filter.
- Breakdown by tag: net result, win rate, count, average trade and drawdown only if drawdown semantics for overlapping groups are accepted.
- Report remains bounded to existing row caps.

### Required semantic decision

A trade with multiple tags appears in each tag group. Group totals therefore overlap and must not be presented as additive partitions. Record this in ADR/UI copy.

### Data/query rules

- Filtering must use `EXISTS`/semi-join semantics so many-to-many joins do not duplicate a trade fact.
- Breakdown may intentionally emit one fact per trade-tag group, but overall KPIs must count each trade once.
- Deleted tags are already detached; historical analytics uses current assignments, consistent with current catalog semantics unless a new historical-snapshot decision is approved.
- Add indexes only after `EXPLAIN QUERY PLAN` and benchmarks.

### Required tests

- Multi-tag trade counted once overall and once in each selected breakdown group.
- OR filter and untagged behavior.
- Tag deletion/Undo invalidates report.
- Row limits and omitted count.
- 100k trade benchmark with realistic tag cardinality.
- Renderer keyboard/accessibility for tag filters.

---

## Slice C — CSV import with dry-run and deduplication

### User outcome

Users can import broker/export history without broker API access and without risking silent duplicate or malformed financial records.

### First-release scope

- User selects a local CSV in main process.
- Preview parses headers and a bounded sample.
- User maps required fields: closed time, symbol, direction, result, result unit, account; optional tags.
- Dry-run validates every row and reports accepted/rejected/duplicate counts before commit.
- Import commit is one atomic batch or explicitly chunked with a resumable import session; never silently partial.
- No automatic broker-specific parsers in the first generic slice.

### Architecture

- Import module/application owns mapping, normalization, row validation, deduplication policy and report DTOs.
- Filesystem/CSV library sits behind an adapter; third-party parser types do not leak.
- Existing trade/account/instrument rules remain authoritative; import must not duplicate finance formulas.
- Unknown instruments/accounts require explicit mapping or approved creation preview.

### Deduplication decision

Define a deterministic import fingerprint from normalized source fields plus optional source name. Persist import batch/fingerprint metadata. Do not deduplicate solely on result/date/symbol if legitimate identical trades are possible.

### Required tests

- BOM, delimiter, quoted fields, RU/EN decimal/date inputs, malformed rows.
- Duplicate file import is idempotent.
- Unknown account/instrument mapping.
- Percent/R conversion snapshot uses the defined chronological import policy; do not use current final balance for all historical rows.
- Failure midway rolls back or resumes exactly as the ADR specifies.
- Large-file streaming; no entire unbounded CSV in renderer memory.
- E2E preview, rejected-row report, commit and repeat import.

---

## Slice D — Saved views and recurring review

### User outcome

Users can save useful filter/layout combinations and reopen a weekly/monthly review without reconstructing state manually.

### Scope

- Named saved view contains typed table/statistics filters and display preferences, not domain data.
- Vault-scoped or application-global ownership must be chosen explicitly; recommendation: vault-scoped because account/instrument/tag IDs are vault-specific.
- Built-in review presets may include current week/month, unreviewed trades and selected tags.
- No new Dashboard page; preserve the accepted decision that Trades is the start page unless product scope changes first.

### Tests

- Schema versioning and invalid/missing referenced IDs.
- Rename/delete account/instrument/tag reconciliation.
- Applying a view does not mutate persistence facts.
- Undo is not used for presentation preference changes unless existing settings behavior already establishes it.
- E2E save, restart, apply and delete view.

---

## Slice dispositions

- Slice A (qualitative trade journal) — accepted by the owner and implemented as permanent roadmap task FND-029 with ADR-0016. Attachments remain a separate future sub-slice with a mandatory ADR.
- Slices B, C and D — deferred; the owner has not selected them. This file stays until they are accepted or rejected.

## Selection protocol

Before implementing a slice:

1. Confirm the user problem and acceptance criteria with the owner.
2. Add one permanent roadmap task with scope, contracts, migrations, tests and status.
3. Add/amend ADRs for persistent schema or ambiguous semantics.
4. Re-read code-map and search for existing contracts.
5. Implement only the selected slice.
6. Run full verification including Electron E2E.

## Completion of this temporary plan

This file is complete when every accepted slice has been converted into its own permanent roadmap task and every rejected/deferred slice is recorded as such. Then delete this file and its README link; do not keep it as a shadow roadmap.
