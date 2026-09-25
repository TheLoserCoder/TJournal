// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { expect, it } from 'vitest';

import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteVaultBackupStore } from './sqlite-vault-backup-store';
import { SqliteVaultDatabase } from './sqlite-vault-database';

const FIXTURE_SIZES_MIB = [10, 100, 256] as const;
const CHUNK_MIB = 1;

it.skipIf(process.env.TJOURNAL_BACKUP_BENCHMARK !== '1')(
  'records verified online-backup timings with live WAL data',
  async () => {
    for (const size of FIXTURE_SIZES_MIB) {
      const parent = mkdtempSync(join(tmpdir(), 'tjournal-backup-benchmark-'));
      const vault = join(parent, 'vault');
      const database = new SqliteVaultDatabase();
      const storage = new SqliteJournalStorage(database);
      try {
        storage.createVault(vault);
        database.require().exec('CREATE TABLE benchmark_payload (data BLOB NOT NULL)');
        const addChunk = database
          .require()
          .prepare('INSERT INTO benchmark_payload (data) VALUES (randomblob(?))');
        for (let index = 0; index < size; index += CHUNK_MIB) addChunk.run(1024 * 1024);
        const store = new SqliteVaultBackupStore(storage, 'benchmark');
        const started = performance.now();
        const backup = await store.create(vault, 'manual');
        const elapsedMs = Math.round(performance.now() - started);
        expect(store.verify(vault, backup.id)).toEqual(backup);
        console.info(
          `backup-benchmark fixtureMiB=${size} snapshotBytes=${backup.databaseBytes} verifiedMs=${elapsedMs}`,
        );
      } finally {
        storage.close();
        rmSync(parent, { force: true, recursive: true });
      }
    }
  },
  180_000,
);
