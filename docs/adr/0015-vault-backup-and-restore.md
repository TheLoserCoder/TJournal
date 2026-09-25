# ADR-0015: Verified SQLite vault backups and restore identity

## Status

Accepted.

## Context

ADR-0002 defines a portable vault with `journal.sqlite`, marker, attachments and `backups/`. Ordinary file copying while SQLite runs in WAL mode can miss committed changes. Opening a vault can apply migrations before the user can recover its prior schema. Financial journal recovery requires a verified snapshot before any pending migration.

## Decision

- `modules/journal` owns backup use cases and `VaultBackupStore`; `platform/database` owns the SQLite and filesystem adapter. The Electron main composition root supplies the application version. The native picker stays in desktop main. Migration orchestration is `OpenVaultUseCase`: inspect/pending-ledger read → verified automatic backup → candidate migration → activation. Startup opens through the same use case. `createVault` starts from an empty database and does not need a pre-migration backup.
- Snapshots use asynchronous `node:sqlite.backup(sourceDb, targetPath)`, available in Electron 44.3.0 (Node 24.20.0), from a separate read-only connection. No raw copy of the live database or busy wait. `openVault` is asynchronous; `createVault` remains synchronous. The alternative `VACUUM INTO ?` would block Electron main for the entire snapshot and was not selected.
- Format v1: `backups/<UTC timestamp>-<random UUID>/journal.sqlite` and `manifest.json`. The manifest contains format version, opaque backup ID, kind, UTC creation time, source vault ID, app version, migration IDs, database byte length and SHA-256; `attachmentsIncluded: false` explicitly records current scope. A temp sibling `.pending-*` is verified (checksum, migration ledger, `PRAGMA integrity_check`) before atomic directory rename. Incomplete/temp/invalid snapshots are never shown as valid. Named automatic retention is 20 newest **valid** automatic snapshots; manual copies are never pruned. Listing is keyset-paged (50 directory entries); verification and restore accept only IDs under the active vault's `backups/`.
- Restore verifies the selected snapshot, stages a new folder beside the selected empty destination, copies only the verified snapshot, checks its checksum and performs normal vault inspection, then renames it into place. It never switches the active vault. The restored marker has a **new** UUID `vaultId` and `restoredFromVaultId`/`restoredFromBackupId` lineage; this preserves original data while distinguishing the two portable vault folders. Marker format version stays 1 because existing readers ignore additional metadata.
- No data revision is emitted for backup or restore. The existing JSONL Logger records event name, kind, duration, byte count or safe error code, never financial data or full paths. Backup/restore errors have safe, localized codes.

## Consequences

An automatic snapshot failure aborts opening before migration and keeps the previous active vault. Backups live inside the portable vault, so copying the whole folder retains them. Manual archives can grow until users manage them outside the app; listing remains bounded. Future attachments require a versioned manifest/restore update; format v1 does not claim to include them. Encryption, scheduling, cloud synchronization and merge are separate product decisions.

When a source vault cannot be opened at all, `tools/recover-vault.mjs` calls the same verifying adapter against an explicit source folder, backup ID and new empty destination. This offline route does not require reading or migrating the damaged source database; its CLI output is a safe error code.

## Evidence

`platform/database/src/sqlite-vault-backup-store.test.ts` exercises committed WAL data, copy identity and lineage, refusal of occupied destinations, corrupt/unsupported manifests, interrupted temp directories, manual retention, bounded listing and pre-migration failure. Electron E2E covers manual backup → restart → restore → explicit open. The opt-in benchmark and recorded timings are in `docs/engineering/backup-recovery.md`.
