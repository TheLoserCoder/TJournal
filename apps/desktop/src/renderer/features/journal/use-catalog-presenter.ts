import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  AccountDto,
  AccountInstrumentDefaultsDto,
  CreateAccountDto,
  CreateTagDto,
  InstrumentDto,
  TableLayoutDto,
  TagDto,
  UpdateAccountDto,
  UpdateInstrumentDto,
  UpdateTagDto,
  SafeErrorDto,
} from '../../../shared/desktop-api';
import type { JournalPresenter } from './use-journal-presenter';

export type CatalogTab = 'accounts' | 'assets' | 'tags';

/** Asset cost profile row being edited inside the account form. */
export interface CatalogAccountDefaultDraft {
  readonly commissionUsd: string;
  readonly instrumentId: string;
  readonly spreadTicks: string;
  /** Empty string means the account has no calculation ticks for the asset. */
  readonly tickSize: string;
  readonly tickValueUsdPerLot: string;
}

export interface CatalogAccountDraft {
  readonly defaults: readonly CatalogAccountDefaultDraft[];
  readonly name: string;
  readonly openingBalanceUsd: string;
}

/**
 * Editing an existing account needs its readable profile list before saving:
 * a save with an unloaded list would replace every stored profile.
 */
export type CatalogAccountDefaultsStatus = 'error' | 'idle' | 'loading' | 'ready';

export type CatalogAccountDefaultField = keyof CatalogAccountDefaultDraft;

export type CatalogBulkEntity = 'account' | 'asset';
export type CatalogBulkAction = 'delete' | 'restore';

/**
 * A confirmed batch walks its ids one command at a time: a failure keeps the
 * unprocessed ids so the user can retry instead of pretending the batch was atomic.
 */
export interface CatalogPendingOperation {
  readonly action: CatalogBulkAction;
  readonly completedCount: number;
  readonly entity: CatalogBulkEntity;
  readonly remainingIds: readonly string[];
}

const EMPTY_ACCOUNT_DRAFT: CatalogAccountDraft = {
  defaults: [],
  name: '',
  openingBalanceUsd: '',
};

const toAccountDefaultDrafts = (
  items: readonly AccountInstrumentDefaultsDto[],
): readonly CatalogAccountDefaultDraft[] =>
  items.map((item) => ({
    commissionUsd: item.commissionUsd,
    instrumentId: item.instrumentId,
    spreadTicks: item.spreadTicks,
    tickSize: item.tickSize ?? '',
    tickValueUsdPerLot: item.tickValueUsdPerLot ?? '',
  }));

const toAccountDefaultInput = (
  draft: CatalogAccountDefaultDraft,
): CreateAccountDto['defaults'][number] => ({
  commissionUsd: draft.commissionUsd,
  instrumentId: draft.instrumentId,
  spreadTicks: draft.spreadTicks,
  tickSize: draft.tickSize.trim() === '' ? null : draft.tickSize.trim(),
  tickValueUsdPerLot:
    draft.tickValueUsdPerLot.trim() === '' ? null : draft.tickValueUsdPerLot.trim(),
});

export interface CatalogPresenter {
  readonly tab: CatalogTab;
  /** Tag catalogue rows with their server-side trade usage counts. */
  readonly tagRows: readonly (TagDto & { readonly tradeCount: number })[];
  readonly accountDefaultsStatus: CatalogAccountDefaultsStatus;
  readonly accountDraft: CatalogAccountDraft;
  readonly accountEditorOpen: boolean;
  readonly accountSaving: boolean;
  readonly accountError: SafeErrorDto | null;
  readonly accountsLayout: TableLayoutDto | undefined;
  readonly assetEditorOpen: boolean;
  readonly assetsLayout: TableLayoutDto | undefined;
  readonly bulkBusy: boolean;
  readonly pendingOperation: CatalogPendingOperation | null;
  readonly editingAccount: AccountDto | null;
  readonly editingAsset: InstrumentDto | null;
  readonly editingTag: TagDto | null;
  readonly tagEditorOpen: boolean;
  readonly tagsLayout: TableLayoutDto | undefined;
  addAccountDefault(): void;
  cancelPendingOperation(): void;
  closeAccountEditor(): void;
  closeAssetEditor(): void;
  closeTagEditor(): void;
  confirmPendingOperation(): void;
  deleteAccount(id: string): Promise<boolean>;
  deleteAsset(id: string): Promise<boolean>;
  deleteTag(id: string): Promise<boolean>;
  deleteTags(ids: readonly string[]): Promise<boolean>;
  editAccount(account: AccountDto | null): void;
  editAsset(asset: InstrumentDto | null): void;
  editTag(tag: TagDto | null): void;
  openAccountEditor(account?: AccountDto): void;
  openAssetEditor(asset?: InstrumentDto): void;
  openTagEditor(tag?: TagDto): void;
  removeAccountDefault(index: number): void;
  requestBulkAction(
    entity: CatalogBulkEntity,
    action: CatalogBulkAction,
    ids: readonly string[],
  ): void;
  restoreAccount(id: string): Promise<boolean>;
  restoreAsset(id: string): Promise<boolean>;
  retryAccountDefaults(): void;
  saveAccount(input: CreateAccountDto | UpdateAccountDto): Promise<boolean>;
  saveAsset(input: UpdateInstrumentDto | Omit<UpdateInstrumentDto, 'id'>): Promise<boolean>;
  saveTag(input: CreateTagDto | UpdateTagDto): Promise<boolean>;
  setAccountDefaultField(index: number, field: CatalogAccountDefaultField, value: string): void;
  setAccountDraftName(value: string): void;
  setAccountDraftOpening(value: string): void;
  setTab(tab: CatalogTab): void;
  submitAccountDraft(): Promise<boolean>;
  updateTableLayout(layout: TableLayoutDto): void;
}

export const useCatalogPresenter = (journal: JournalPresenter): CatalogPresenter => {
  const [tab, setTab] = useState<CatalogTab>('accounts');
  const [editingAccount, setEditingAccount] = useState<AccountDto | null>(null);
  const [editingAsset, setEditingAsset] = useState<InstrumentDto | null>(null);
  const [editingTag, setEditingTag] = useState<TagDto | null>(null);
  const [accountEditorOpen, setAccountEditorOpen] = useState(false);
  const [assetEditorOpen, setAssetEditorOpen] = useState(false);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [accountDraft, setAccountDraft] = useState<CatalogAccountDraft>(EMPTY_ACCOUNT_DRAFT);
  const [accountDefaultsStatus, setAccountDefaultsStatus] =
    useState<CatalogAccountDefaultsStatus>('idle');
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountSaveFailed, setAccountSaveFailed] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<CatalogPendingOperation | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const accountDefaultsRequest = useRef(0);
  const disposed = useRef(false);
  const bulkBusyRef = useRef(false);

  // The catalogue presenter lives inside the keyed vault workspace: after a vault
  // switch every pending continuation must stop issuing commands.
  useEffect(
    () => () => {
      disposed.current = true;
    },
    [],
  );

  const loadAccountDefaults = (account: AccountDto): void => {
    const requestId = accountDefaultsRequest.current + 1;
    accountDefaultsRequest.current = requestId;
    setAccountDefaultsStatus('loading');
    void journal.listAccountDefaults(account.id).then((defaults) => {
      // A response for a closed editor or another account must not leak into the draft.
      if (accountDefaultsRequest.current !== requestId) return;
      if (defaults === null) {
        setAccountDefaultsStatus('error');
        return;
      }
      setAccountDraft((current) => ({ ...current, defaults: toAccountDefaultDrafts(defaults) }));
      setAccountDefaultsStatus('ready');
    });
  };

  const openAccountEditor = (account?: AccountDto): void => {
    setAccountSaveFailed(false);
    setEditingAccount(account ?? null);
    setAccountEditorOpen(true);
    setAccountSaving(false);
    if (account === undefined) {
      accountDefaultsRequest.current += 1;
      setAccountDraft(EMPTY_ACCOUNT_DRAFT);
      setAccountDefaultsStatus('idle');
      return;
    }
    setAccountDraft({
      defaults: [],
      name: account.name,
      openingBalanceUsd: account.openingBalanceUsd,
    });
    loadAccountDefaults(account);
  };

  const openTagEditor = (tag?: TagDto): void => {
    setEditingTag(tag ?? null);
    setTagEditorOpen(true);
  };

  const saveAccount = async (input: CreateAccountDto | UpdateAccountDto): Promise<boolean> => {
    const saved =
      'id' in input ? await journal.updateAccount(input) : await journal.createAccount(input);
    setAccountSaveFailed(saved === null);
    return saved !== null;
  };

  const saveAsset = async (
    input: UpdateInstrumentDto | Omit<UpdateInstrumentDto, 'id'>,
  ): Promise<boolean> => {
    const saved =
      'id' in input ? await journal.updateInstrument(input) : await journal.createInstrument(input);
    if (saved === null) return false;
    setEditingAsset(null);
    setAssetEditorOpen(false);
    return true;
  };

  const saveTag = async (input: CreateTagDto | UpdateTagDto): Promise<boolean> => {
    const saved = 'id' in input ? await journal.updateTag(input) : await journal.createTag(input);
    if (saved === null) return false;
    setEditingTag(null);
    setTagEditorOpen(false);
    return true;
  };

  const submitAccountDraft = async (): Promise<boolean> => {
    if (accountSaving) return false;
    const account = editingAccount;
    if (account !== null && accountDefaultsStatus !== 'ready') return false;
    setAccountSaving(true);
    try {
      const saved = await saveAccount({
        ...(account === null ? {} : { id: account.id }),
        defaults: accountDraft.defaults.map(toAccountDefaultInput),
        name: accountDraft.name,
        openingBalanceUsd: accountDraft.openingBalanceUsd,
      });
      if (!saved) return false;
      accountDefaultsRequest.current += 1;
      setAccountEditorOpen(false);
      setEditingAccount(null);
      setAccountDraft(EMPTY_ACCOUNT_DRAFT);
      setAccountDefaultsStatus('idle');
      return true;
    } finally {
      setAccountSaving(false);
    }
  };

  const deleteAccountById = async (id: string): Promise<boolean> =>
    (await journal.deleteAccount(id)) !== null;
  const deleteAssetById = async (id: string): Promise<boolean> =>
    (await journal.deleteInstrument(id)) !== null;
  const restoreAccountById = async (id: string): Promise<boolean> =>
    (await journal.restoreAccount(id)) !== null;
  const restoreAssetById = async (id: string): Promise<boolean> =>
    (await journal.restoreInstrument(id)) !== null;

  const executeBulkStep = (pending: CatalogPendingOperation, id: string): Promise<boolean> => {
    if (pending.entity === 'account') {
      return pending.action === 'delete' ? deleteAccountById(id) : restoreAccountById(id);
    }
    return pending.action === 'delete' ? deleteAssetById(id) : restoreAssetById(id);
  };

  const runPendingOperation = async (initial: CatalogPendingOperation): Promise<void> => {
    if (bulkBusyRef.current) return;
    bulkBusyRef.current = true;
    setBulkBusy(true);
    let current = initial;
    try {
      while (current.remainingIds.length > 0) {
        if (disposed.current) return;
        const id = current.remainingIds[0];
        if (id === undefined) break;
        const succeeded = await executeBulkStep(current, id);
        if (disposed.current) return;
        if (!succeeded) break;
        current = {
          ...current,
          completedCount: current.completedCount + 1,
          remainingIds: current.remainingIds.slice(1),
        };
        // The delete dialog stays open to show progress; a restore only opens
        // one when a command failed and needs a retry.
        if (initial.action === 'delete') setPendingOperation(current);
      }
      if (current.remainingIds.length === 0) setPendingOperation(null);
      else if (initial.action === 'restore') setPendingOperation(current);
    } finally {
      bulkBusyRef.current = false;
      setBulkBusy(false);
    }
  };

  const tagRows = useMemo(
    () =>
      journal.tags.map((tag) => ({
        ...tag,
        tradeCount: journal.tagTradeCounts[tag.id] ?? 0,
      })),
    [journal.tags, journal.tagTradeCounts],
  );

  return {
    accountsLayout: journal.settings.tableLayouts.find((layout) => layout.id === 'accounts'),
    accountDefaultsStatus,
    accountDraft,
    accountEditorOpen,
    accountError: accountEditorOpen && accountSaveFailed ? (journal.error ?? null) : null,
    accountSaving,
    assetEditorOpen,
    bulkBusy,
    pendingOperation,
    tagEditorOpen,
    tagRows,
    assetsLayout: journal.settings.tableLayouts.find((layout) => layout.id === 'assets'),
    tagsLayout: journal.settings.tableLayouts.find((layout) => layout.id === 'tags'),
    addAccountDefault: () =>
      setAccountDraft((current) => {
        const first = journal.instruments.find(
          (asset) =>
            asset.archivedAt === null &&
            !current.defaults.some((item) => item.instrumentId === asset.id),
        );
        if (first === undefined) return current;
        return {
          ...current,
          defaults: [
            ...current.defaults,
            {
              commissionUsd: '0',
              instrumentId: first.id,
              spreadTicks: '0',
              tickSize: '',
              tickValueUsdPerLot: '',
            },
          ],
        };
      }),
    cancelPendingOperation: () => {
      if (bulkBusyRef.current) return;
      setPendingOperation(null);
    },
    closeAccountEditor: () => {
      setAccountSaveFailed(false);
      accountDefaultsRequest.current += 1;
      setAccountEditorOpen(false);
      setEditingAccount(null);
      setAccountSaving(false);
      setAccountDraft(EMPTY_ACCOUNT_DRAFT);
      setAccountDefaultsStatus('idle');
    },
    closeAssetEditor: () => {
      setAssetEditorOpen(false);
      setEditingAsset(null);
    },
    closeTagEditor: () => {
      setTagEditorOpen(false);
      setEditingTag(null);
    },
    confirmPendingOperation: () => {
      if (pendingOperation === null) return;
      void runPendingOperation(pendingOperation);
    },
    deleteAccount: deleteAccountById,
    deleteAsset: deleteAssetById,
    deleteTag: (id) => journal.deleteTags([id]),
    deleteTags: (ids) => journal.deleteTags(ids),
    editAccount: (account) => {
      if (account === null) {
        openAccountEditor();
        return;
      }
      openAccountEditor(account);
    },
    editAsset: (asset) => {
      setEditingAsset(asset);
      setAssetEditorOpen(true);
    },
    editTag: (tag) => openTagEditor(tag ?? undefined),
    editingAccount,
    editingAsset,
    editingTag,
    openAccountEditor,
    openAssetEditor: (asset) => {
      setEditingAsset(asset ?? null);
      setAssetEditorOpen(true);
    },
    openTagEditor,
    removeAccountDefault: (index) =>
      setAccountDraft((current) => ({
        ...current,
        defaults: current.defaults.filter((_item, currentIndex) => currentIndex !== index),
      })),
    requestBulkAction: (entity, action, ids) => {
      const uniqueIds = [...new Set(ids)];
      if (uniqueIds.length === 0) return;
      const pending: CatalogPendingOperation = {
        action,
        completedCount: 0,
        entity,
        remainingIds: uniqueIds,
      };
      if (action === 'restore') {
        // Restore is safe to start from the button; a failure re-opens the
        // operation as a retryable pending list.
        void runPendingOperation(pending);
        return;
      }
      setPendingOperation(pending);
    },
    restoreAccount: restoreAccountById,
    restoreAsset: restoreAssetById,
    retryAccountDefaults: () => {
      if (editingAccount === null) return;
      loadAccountDefaults(editingAccount);
    },
    saveAccount,
    saveAsset,
    saveTag,
    setAccountDefaultField: (index, field, value) =>
      setAccountDraft((current) => ({
        ...current,
        defaults: current.defaults.map((item, currentIndex) =>
          currentIndex === index ? { ...item, [field]: value } : item,
        ),
      })),
    setAccountDraftName: (name) => {
      setAccountSaveFailed(false);
      setAccountDraft((current) => ({ ...current, name }));
    },
    setAccountDraftOpening: (openingBalanceUsd) => {
      setAccountSaveFailed(false);
      setAccountDraft((current) => ({ ...current, openingBalanceUsd }));
    },
    setTab,
    submitAccountDraft,
    tab,
    updateTableLayout: (layout) => void journal.updateTableLayout(layout),
  };
};
