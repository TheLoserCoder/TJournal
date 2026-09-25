import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  SqliteJournalStorage,
  SqliteVaultBackupStore,
} = require('../platform/database/.tsbuild/index.js');

const [source, backupId, destination, ...extra] = process.argv.slice(2);
if (
  source === undefined ||
  backupId === undefined ||
  destination === undefined ||
  extra.length > 0
) {
  process.stderr.write('validation-invalid\n');
  process.exitCode = 2;
} else {
  try {
    const store = new SqliteVaultBackupStore(new SqliteJournalStorage(), 'offline-recovery');
    await store.restore(source, backupId, destination);
  } catch (error) {
    process.stderr.write(
      `${error && typeof error === 'object' && 'code' in error ? error.code : 'unexpected'}\n`,
    );
    process.exitCode = 1;
  }
}
