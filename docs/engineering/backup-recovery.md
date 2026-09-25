# Vault backup and recovery

## Create and verify

Open **Settings → Vault → Create backup**. A verified copy appears in **Available backups**. Choose a copy and select **Verify backup** to recheck its checksum, SQLite integrity and migration ledger. The backups are inside the active vault folder at `backups/<backup-id>/`, each with `journal.sqlite` and `manifest.json`. `Older backups` and `Newest backups` page through the archive without loading every snapshot into the renderer.

When an existing vault has pending schema migrations, opening it creates and verifies an **automatic** copy _before_ applying them. If that fails, opening stops and the active vault remains unchanged. A new empty vault and a vault without pending migrations do not produce an automatic backup. The newest 20 valid automatic backups per vault are kept. Manual backups are not deleted automatically; users must monitor disk usage. Incomplete `.pending-*` directories are not selectable and may be inspected manually before cleanup.

## Restore

While the source vault is active, choose a backup and click **Restore to new folder**. Select a new or empty directory **outside the source vault**; an occupied directory is rejected. The application verifies the manifest and database before restoring, creates a new vault marker ID with lineage, and leaves the active vault untouched. Then use **Change vault** and choose the restored folder to open it explicitly. Never restore directly over the active vault or replace an existing non-empty folder.

If the active vault fails an integrity check, do not edit its SQLite files or its backups. Preserve a copy of the whole folder. if the application cannot open the damaged source vault, use the offline recovery command from a source checkout of the project: first run `pnpm typecheck`, then `node tools/recover-vault.mjs "<source-vault-folder>" "<backup-id>" "<new-empty-destination-folder>"`. The tool is a source-checkout script and is not part of the installed application; it needs the workspace dependencies installed. The backup ID is the name of a completed directory directly under the source's `backups/` (ignore `.pending-*`). The command checks its manifest, SHA-256, migration ledger and SQLite integrity before creating a separate vault with a new ID and lineage. It does not open or modify the damaged source database and exits nonzero with a safe error code on failure. Then open the newly recovered folder through **Change vault** or the first-run **Open vault** action. Never manually replace the active `journal.sqlite` or copy a live SQLite file while WAL is in use.

Only the SQLite snapshot and an **empty `attachments/` directory** are restored in format v1. Attachments have no current product lifecycle; future attachment support must change the manifest and verification contract. App-wide preferences and logs are outside the vault and are not backed up. Encryption, cloud sync, scheduled copies and conflict merging are not included.

## Snapshot benchmark

Run `TJOURNAL_BACKUP_BENCHMARK=1 pnpm exec vitest run platform/database/src/vault-backup-benchmark.test.ts` (PowerShell: `$env:TJOURNAL_BACKUP_BENCHMARK='1'; pnpm.cmd exec vitest run platform/database/src/vault-backup-benchmark.test.ts`). This creates live WAL fixtures and measures creation **including checksum, integrity check, manifest and verification**. On 2026-09-23 in the local Node 24 environment: 10 MiB payload → 10,686,464-byte snapshot, 95 ms; 100 MiB → 105,181,184 bytes, 569 ms; 256 MiB → 268,972,032 bytes, 1293 ms. These are observed timings, not performance limits; Electron E2E separately verifies its bundled Node implementation and UI path.
