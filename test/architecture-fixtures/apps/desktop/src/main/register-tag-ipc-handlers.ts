// Intentional violation: IPC registrars must not construct concrete SQLite adapters.
import { SqliteTagStore } from '@tjournal/platform-database';

export const store = SqliteTagStore;
