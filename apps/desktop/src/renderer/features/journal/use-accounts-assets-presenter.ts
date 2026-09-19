import { useState } from 'react';

import type {
  AccountDto,
  AccountInstrumentDefaultsDto,
  CreateAccountDto,
  InstrumentDto,
  TableLayoutDto,
  UpdateAccountDto,
  UpdateInstrumentDto,
} from '../../../shared/desktop-api';
import type { JournalPresenter } from './use-journal-presenter';

export type AccountsAssetsTab = 'accounts' | 'assets';

export interface AccountsAssetsPresenter {
  readonly tab: AccountsAssetsTab;
  readonly editingAccount: AccountDto | null;
  readonly editingAsset: InstrumentDto | null;
  readonly accountEditorOpen: boolean;
  readonly assetEditorOpen: boolean;
  readonly accountsLayout: TableLayoutDto | undefined;
  readonly assetsLayout: TableLayoutDto | undefined;
  updateTableLayout(layout: TableLayoutDto): void;
  setTab(tab: AccountsAssetsTab): void;
  closeAccountEditor(): void;
  closeAssetEditor(): void;
  openAccountEditor(account?: AccountDto): void;
  openAssetEditor(asset?: InstrumentDto): void;
  editAccount(account: AccountDto | null): void;
  editAsset(asset: InstrumentDto | null): void;
  saveAccount(input: CreateAccountDto | UpdateAccountDto): Promise<void>;
  saveAsset(input: UpdateInstrumentDto | Omit<UpdateInstrumentDto, 'id'>): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  restoreAccount(id: string): Promise<void>;
  deleteAsset(id: string): Promise<void>;
  restoreAsset(id: string): Promise<void>;
  loadDefaults(accountId: string): Promise<readonly AccountInstrumentDefaultsDto[]>;
}

export const useAccountsAssetsPresenter = (journal: JournalPresenter): AccountsAssetsPresenter => {
  const [tab, setTab] = useState<AccountsAssetsTab>('accounts');
  const [editingAccount, setEditingAccount] = useState<AccountDto | null>(null);
  const [editingAsset, setEditingAsset] = useState<InstrumentDto | null>(null);
  const [accountEditorOpen, setAccountEditorOpen] = useState(false);
  const [assetEditorOpen, setAssetEditorOpen] = useState(false);
  return {
    accountsLayout: journal.settings.tableLayouts.find((layout) => layout.id === 'accounts'),
    accountEditorOpen,
    assetEditorOpen,
    assetsLayout: journal.settings.tableLayouts.find((layout) => layout.id === 'assets'),
    closeAccountEditor: () => {
      setAccountEditorOpen(false);
      setEditingAccount(null);
    },
    closeAssetEditor: () => {
      setAssetEditorOpen(false);
      setEditingAsset(null);
    },
    deleteAccount: async (id) => {
      await journal.deleteAccount(id);
    },
    deleteAsset: async (id) => {
      await journal.deleteInstrument(id);
    },
    editAccount: (account) => {
      setEditingAccount(account);
      setAccountEditorOpen(true);
    },
    editAsset: (asset) => {
      setEditingAsset(asset);
      setAssetEditorOpen(true);
    },
    editingAccount,
    editingAsset,
    openAccountEditor: (account) => {
      setEditingAccount(account ?? null);
      setAccountEditorOpen(true);
    },
    openAssetEditor: (asset) => {
      setEditingAsset(asset ?? null);
      setAssetEditorOpen(true);
    },
    restoreAccount: async (id) => {
      await journal.restoreAccount(id);
    },
    restoreAsset: async (id) => {
      await journal.restoreInstrument(id);
    },
    loadDefaults: (accountId) => journal.listAccountDefaults(accountId),
    saveAccount: async (input) => {
      if ('id' in input) {
        await journal.updateAccount(input);
      } else await journal.createAccount(input);
      setEditingAccount(null);
      setAccountEditorOpen(false);
    },
    saveAsset: async (input) => {
      if ('id' in input) await journal.updateInstrument(input);
      else await journal.createInstrument(input);
      setEditingAsset(null);
      setAssetEditorOpen(false);
    },
    setTab,
    tab,
    updateTableLayout: (layout) => void journal.updateTableLayout(layout),
  };
};
