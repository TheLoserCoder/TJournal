// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  CreateAccountUseCase,
  CreateCashMovementUseCase,
  DeleteAccountUseCase,
  DeleteCashMovementUseCase,
  GetAccountByIdUseCase,
  GetCashMovementByIdUseCase,
  ListAccountDefaultsUseCase,
  ListInstrumentDefaultsUseCase,
  RestoreAccountSnapshotUseCase,
  RestoreInstrumentDefaultsUseCase,
} from '@tjournal/account';
import {
  CreateInstrumentUseCase,
  DeleteInstrumentUseCase,
  GetInstrumentByIdUseCase,
} from '@tjournal/instrument';

import { SqliteAccountStore } from './sqlite-account-store';
import { SqliteInstrumentStore } from './sqlite-instrument-store';
import { SqliteJournalStorage } from './sqlite-journal-storage';
import { SqliteVaultDatabase } from './sqlite-vault-database';

const withVault = (run: (context: ReturnType<typeof openVault>) => void): void => {
  const parent = mkdtempSync(join(tmpdir(), 'tjournal-undo-'));
  const context = openVault(parent);
  try {
    run(context);
  } finally {
    context.database.close();
    rmSync(parent, { force: true, recursive: true });
  }
};

const openVault = (parent: string) => {
  const database = new SqliteVaultDatabase();
  const storage = new SqliteJournalStorage(database);
  storage.createVault(join(parent, 'vault'));
  const seedInstrument = new SqliteInstrumentStore(database).listInstruments()[0];
  if (seedInstrument === undefined) throw new Error('Seed instrument is missing.');
  return {
    accounts: new SqliteAccountStore(database),
    database,
    instruments: new SqliteInstrumentStore(database),
    seedInstrumentId: seedInstrument.id,
  };
};

describe('undo snapshot restoration', () => {
  it('restores a physically deleted account and its defaults exactly', () => {
    withVault(({ accounts, seedInstrumentId }) => {
      const createAccount = new CreateAccountUseCase(accounts);
      const deleteAccount = new DeleteAccountUseCase(accounts);
      const getAccount = new GetAccountByIdUseCase(accounts);
      const listDefaults = new ListAccountDefaultsUseCase(accounts);
      const restoreSnapshot = new RestoreAccountSnapshotUseCase(accounts);

      createAccount.execute(
        {
          defaults: [{ commissionUsd: '1.25', instrumentId: seedInstrumentId, spreadTicks: '2' }],
          name: 'Main',
          openingBalanceUsd: '10000',
        },
        'account-1',
      );
      const accountSnapshot = getAccount.execute('account-1');
      const defaultsSnapshot = listDefaults.execute('account-1');
      if (accountSnapshot === null) throw new Error('Account was not created.');

      deleteAccount.execute('account-1');
      expect(getAccount.execute('account-1')).toBeNull();

      restoreSnapshot.execute(accountSnapshot, defaultsSnapshot);

      expect(getAccount.execute('account-1')).toEqual(accountSnapshot);
      expect(listDefaults.execute('account-1')).toEqual(defaultsSnapshot);
    });
  });

  it('re-applies removed instrument defaults without dropping newer ones', () => {
    withVault(({ accounts, instruments, seedInstrumentId }) => {
      const createAccount = new CreateAccountUseCase(accounts);
      const createInstrument = new CreateInstrumentUseCase(instruments);
      const deleteInstrument = new DeleteInstrumentUseCase(instruments);
      const getInstrument = new GetInstrumentByIdUseCase(instruments);
      const listAccountDefaults = new ListAccountDefaultsUseCase(accounts);
      const listInstrumentDefaults = new ListInstrumentDefaultsUseCase(accounts);
      const restoreInstrumentDefaults = new RestoreInstrumentDefaultsUseCase(accounts);

      createInstrument.execute({ category: 'index', symbol: 'NQ' }, 'instrument-b');
      createInstrument.execute({ category: 'index', symbol: 'ES' }, 'instrument-c');
      createAccount.execute(
        {
          defaults: [
            { commissionUsd: '1', instrumentId: seedInstrumentId, spreadTicks: '2' },
            { commissionUsd: '2', instrumentId: 'instrument-b', spreadTicks: '3' },
          ],
          name: 'Main',
          openingBalanceUsd: '10000',
        },
        'account-1',
      );

      const snapshot = listInstrumentDefaults.execute('instrument-b');
      expect(snapshot).toHaveLength(1);

      deleteInstrument.execute('instrument-b');
      expect(getInstrument.execute('instrument-b')).toBeNull();
      expect(listAccountDefaults.execute('account-1')).toHaveLength(1);

      // A default configured while the instrument was deleted must survive.
      accounts.saveDefaults('account-1', [
        ...listAccountDefaults.execute('account-1'),
        {
          accountId: 'account-1',
          commissionUsd: '3',
          instrumentId: 'instrument-c',
          spreadTicks: '4',
          updatedAt: '2026-09-22T00:00:00.000Z',
        },
      ]);

      createInstrument.execute({ category: 'index', symbol: 'NQ' }, 'instrument-b');
      restoreInstrumentDefaults.execute(snapshot);

      const restored = listAccountDefaults.execute('account-1');
      expect(restored.map((item) => item.instrumentId).sort()).toEqual(
        ['instrument-b', 'instrument-c', seedInstrumentId].sort(),
      );
      expect(restored.find((item) => item.instrumentId === 'instrument-b')).toEqual(snapshot[0]);
    });
  });

  it('recreates a deleted cash movement with its original identity and timestamp', () => {
    withVault(({ accounts, seedInstrumentId }) => {
      const createAccount = new CreateAccountUseCase(accounts);
      const createMovement = new CreateCashMovementUseCase(accounts);
      const deleteMovement = new DeleteCashMovementUseCase(accounts);
      const getMovement = new GetCashMovementByIdUseCase(accounts);

      createAccount.execute(
        {
          defaults: [{ commissionUsd: '1', instrumentId: seedInstrumentId, spreadTicks: '2' }],
          name: 'Main',
          openingBalanceUsd: '10000',
        },
        'account-1',
      );
      createMovement.execute(
        {
          accountId: 'account-1',
          amountUsd: '500',
          kind: 'deposit',
          occurredAt: '2026-09-20T10:00:00.000Z',
        },
        'movement-1',
      );
      const snapshot = getMovement.execute('movement-1');
      if (snapshot === null) throw new Error('Movement was not created.');

      deleteMovement.execute('movement-1');
      expect(getMovement.execute('movement-1')).toBeNull();

      createMovement.execute(
        {
          accountId: snapshot.accountId,
          amountUsd: snapshot.amountUsd,
          kind: snapshot.kind,
          occurredAt: snapshot.occurredAt,
        },
        snapshot.id,
      );

      expect(getMovement.execute('movement-1')).toEqual(snapshot);
    });
  });
});
