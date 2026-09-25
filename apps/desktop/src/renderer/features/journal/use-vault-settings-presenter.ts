import { useCallback, useEffect, useState } from 'react';

import type { SafeErrorDto, VaultBackupDto } from '../../../shared/desktop-api';
import type { JournalPresenter } from './use-journal-presenter';

export type VaultPendingAction =
  'change' | 'check' | 'reveal' | 'backup' | 'verify' | 'restore' | 'more';
export type VaultValidationState = 'idle' | 'invalid' | 'valid';
export type VaultBackupOutcome = 'created' | 'verified' | 'restored' | null;

export interface VaultSettingsPresenter {
  readonly error: SafeErrorDto | null;
  readonly pendingAction: VaultPendingAction | null;
  readonly validationState: VaultValidationState;
  readonly vaultPath: string | null;
  readonly backups: readonly VaultBackupDto[];
  readonly selectedBackupId: string;
  readonly backupOutcome: VaultBackupOutcome;
  readonly nextBackupCursor: string | null;
  readonly showingOlderBackups: boolean;
  showNewestBackups(): Promise<void>;
  loadMoreBackups(): Promise<void>;
  selectBackup(id: string): void;
  createBackup(): Promise<void>;
  verifyBackup(): Promise<void>;
  restoreBackup(): Promise<void>;
  changeVault(): Promise<void>;
  checkVault(): Promise<void>;
  revealVaultFolder(): Promise<void>;
}

/**
 * Owns the settings-page vault UI state: which action is running, the outcome
 * of the last validation and the last safe error. The typed gateway operations
 * stay in the journal presenter; this presenter only sequences them for the View.
 */
export const useVaultSettingsPresenter = (journal: JournalPresenter): VaultSettingsPresenter => {
  const [pendingAction, setPendingAction] = useState<VaultPendingAction | null>(null);
  const [validationState, setValidationState] = useState<VaultValidationState>('idle');
  const [error, setError] = useState<SafeErrorDto | null>(null);
  const [backups, setBackups] = useState<readonly VaultBackupDto[]>([]);
  const [nextBackupCursor, setNextBackupCursor] = useState<string | null>(null);
  const [showingOlderBackups, setShowingOlderBackups] = useState(false);
  const [selectedBackupId, selectBackup] = useState('');
  const [backupOutcome, setBackupOutcome] = useState<VaultBackupOutcome>(null);
  const listVaultBackups = journal.listVaultBackups;

  const refreshBackups = useCallback(
    async (beforeId: string | null = null): Promise<void> => {
      const result = await listVaultBackups(beforeId);
      if (result.ok) {
        setBackups(result.value.backups);
        setNextBackupCursor(result.value.nextCursor);
        setShowingOlderBackups(beforeId !== null);
        selectBackup((previous) =>
          result.value.backups.some((item) => item.id === previous)
            ? previous
            : (result.value.backups[0]?.id ?? ''),
        );
      } else setError(result.error);
    },
    [listVaultBackups],
  );

  useEffect(() => {
    if (journal.vaultPath === null) return;
    void refreshBackups();
  }, [journal.vaultPath, refreshBackups]);

  const loadMoreBackups = useCallback(async (): Promise<void> => {
    if (pendingAction !== null || nextBackupCursor === null) return;
    setPendingAction('more');
    try {
      await refreshBackups(nextBackupCursor);
    } finally {
      setPendingAction(null);
    }
  }, [nextBackupCursor, pendingAction, refreshBackups]);

  const createBackup = useCallback(async (): Promise<void> => {
    if (pendingAction !== null) return;
    setPendingAction('backup');
    setBackupOutcome(null);
    try {
      const result = await journal.createVaultBackup();
      setError(result.ok ? null : result.error);
      if (result.ok) {
        await refreshBackups();
        selectBackup(result.value.id);
        setBackupOutcome('created');
      }
    } finally {
      setPendingAction(null);
    }
  }, [journal, pendingAction, refreshBackups]);

  const verifyBackup = useCallback(async (): Promise<void> => {
    if (pendingAction !== null || selectedBackupId === '') return;
    setPendingAction('verify');
    setBackupOutcome(null);
    try {
      const result = await journal.verifyVaultBackup(selectedBackupId);
      setError(result.ok ? null : result.error);
      if (result.ok) setBackupOutcome('verified');
    } finally {
      setPendingAction(null);
    }
  }, [journal, pendingAction, selectedBackupId]);

  const restoreBackup = useCallback(async (): Promise<void> => {
    if (pendingAction !== null || selectedBackupId === '') return;
    setPendingAction('restore');
    setBackupOutcome(null);
    try {
      const result = await journal.restoreVaultBackup(selectedBackupId);
      setError(result.ok ? null : result.error);
      if (result.ok && result.value !== null) setBackupOutcome('restored');
    } finally {
      setPendingAction(null);
    }
  }, [journal, pendingAction, selectedBackupId]);

  const changeVault = useCallback(async (): Promise<void> => {
    setPendingAction('change');
    try {
      setValidationState('idle');
      setError(await journal.openVault());
    } finally {
      setPendingAction(null);
    }
  }, [journal]);

  const checkVault = useCallback(async (): Promise<void> => {
    setPendingAction('check');
    try {
      const result = await journal.validateVault();
      setValidationState(result === null ? 'valid' : 'invalid');
      setError(result);
    } finally {
      setPendingAction(null);
    }
  }, [journal]);

  const revealVaultFolder = useCallback(async (): Promise<void> => {
    setPendingAction('reveal');
    try {
      setError(await journal.revealVaultFolder());
    } finally {
      setPendingAction(null);
    }
  }, [journal]);

  return {
    changeVault,
    backups,
    nextBackupCursor,
    showingOlderBackups,
    showNewestBackups: () => refreshBackups(),
    loadMoreBackups,
    selectedBackupId,
    selectBackup,
    createBackup,
    verifyBackup,
    restoreBackup,
    backupOutcome,
    checkVault,
    error,
    pendingAction,
    revealVaultFolder,
    validationState,
    vaultPath: journal.vaultPath,
  };
};
