// Intentional violation: an application command must not import the SQLite adapter.
import { SqliteTradeStore } from '@tjournal/platform-database';

export const Store = SqliteTradeStore;
