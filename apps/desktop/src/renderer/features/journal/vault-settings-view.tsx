import {
  CircleCheck,
  Database,
  FolderCog,
  FolderOpen,
  ShieldCheck,
  Archive,
  RotateCcw,
  BadgeCheck,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/ui/button';
import { BUTTON_VARIANTS } from '../../components/ui/button.config';
import { Select } from '../../components/ui/select';
import { ERROR_TRANSLATION_KEYS, TRANSLATION_KEYS } from '../../i18n-keys';
import type { VaultSettingsPresenter } from './use-vault-settings-presenter';

const ICON_SIZE = 16;

export const VaultSettingsView = ({
  presenter,
}: {
  readonly presenter: VaultSettingsPresenter;
}): ReactElement => {
  const { t } = useTranslation();
  const busy = presenter.pendingAction !== null;

  return (
    <section className="settings-card">
      <h2>
        <Database aria-hidden="true" size={ICON_SIZE} />
        {t(TRANSLATION_KEYS.settingsVault)}
      </h2>
      <div className="settings-vault-path">
        <span>{t(TRANSLATION_KEYS.settingsVaultPath)}</span>
        <code title={presenter.vaultPath ?? undefined}>
          {presenter.vaultPath ?? t(TRANSLATION_KEYS.tableNotApplicable)}
        </code>
      </div>
      <p className="form-help">{t(TRANSLATION_KEYS.settingsVaultHint)}</p>
      <div className="settings-actions">
        <Button
          disabled={busy}
          onClick={() => void presenter.changeVault()}
          type="button"
          variant={BUTTON_VARIANTS.secondary}
        >
          <FolderCog aria-hidden="true" size={ICON_SIZE} />
          {t(TRANSLATION_KEYS.settingsVaultChange)}
        </Button>
        <Button
          disabled={busy}
          onClick={() => void presenter.revealVaultFolder()}
          type="button"
          variant={BUTTON_VARIANTS.secondary}
        >
          <FolderOpen aria-hidden="true" size={ICON_SIZE} />
          {t(TRANSLATION_KEYS.settingsVaultOpenFolder)}
        </Button>
        <Button
          disabled={busy}
          onClick={() => void presenter.checkVault()}
          type="button"
          variant={BUTTON_VARIANTS.secondary}
        >
          <ShieldCheck aria-hidden="true" size={ICON_SIZE} />
          {t(
            presenter.pendingAction === 'check'
              ? TRANSLATION_KEYS.settingsVaultChecking
              : TRANSLATION_KEYS.settingsVaultCheck,
          )}
        </Button>
      </div>
      <div className="settings-vault-backups">
        <div className="settings-actions">
          <Button
            aria-label={t(TRANSLATION_KEYS.settingsVaultBackup)}
            title={t(TRANSLATION_KEYS.settingsVaultBackup)}
            disabled={busy || presenter.vaultPath === null}
            onClick={() => void presenter.createBackup()}
            type="button"
            variant={BUTTON_VARIANTS.secondary}
          >
            <Archive aria-hidden="true" size={ICON_SIZE} />
            {t(TRANSLATION_KEYS.settingsVaultBackup)}
          </Button>
        </div>
        <span className="settings-field-label">{t(TRANSLATION_KEYS.settingsVaultBackupList)}</span>
        <Select
          ariaLabel={t(TRANSLATION_KEYS.settingsVaultBackupList)}
          disabled={busy || presenter.backups.length === 0}
          onValueChange={presenter.selectBackup}
          options={presenter.backups.map((backup) => ({
            label: `${backup.createdAt} · ${t(
              backup.kind === 'manual'
                ? TRANSLATION_KEYS.settingsVaultBackupManual
                : TRANSLATION_KEYS.settingsVaultBackupAutomatic,
            )}`,
            value: backup.id,
          }))}
          placeholder={t(TRANSLATION_KEYS.settingsVaultBackupEmpty)}
          value={presenter.selectedBackupId}
        />
        {presenter.showingOlderBackups && (
          <Button
            disabled={busy}
            onClick={() => void presenter.showNewestBackups()}
            type="button"
            variant={BUTTON_VARIANTS.secondary}
          >
            {t(TRANSLATION_KEYS.settingsVaultBackupNewest)}
          </Button>
        )}
        {presenter.nextBackupCursor !== null && (
          <Button
            disabled={busy}
            onClick={() => void presenter.loadMoreBackups()}
            type="button"
            variant={BUTTON_VARIANTS.secondary}
          >
            {t(TRANSLATION_KEYS.settingsVaultBackupMore)}
          </Button>
        )}
        <div className="settings-actions">
          <Button
            aria-label={t(TRANSLATION_KEYS.settingsVaultVerifyBackup)}
            title={t(TRANSLATION_KEYS.settingsVaultVerifyBackup)}
            disabled={busy || presenter.selectedBackupId === ''}
            onClick={() => void presenter.verifyBackup()}
            type="button"
            variant={BUTTON_VARIANTS.secondary}
          >
            <BadgeCheck aria-hidden="true" size={ICON_SIZE} />
            {t(TRANSLATION_KEYS.settingsVaultVerifyBackup)}
          </Button>
          <Button
            aria-label={t(TRANSLATION_KEYS.settingsVaultRestore)}
            title={t(TRANSLATION_KEYS.settingsVaultRestore)}
            disabled={busy || presenter.selectedBackupId === ''}
            onClick={() => void presenter.restoreBackup()}
            type="button"
            variant={BUTTON_VARIANTS.secondary}
          >
            <RotateCcw aria-hidden="true" size={ICON_SIZE} />
            {t(TRANSLATION_KEYS.settingsVaultRestore)}
          </Button>
        </div>
      </div>
      {presenter.backupOutcome !== null && (
        <p className="settings-vault-status" role="status">
          <CircleCheck aria-hidden="true" size={ICON_SIZE} />
          {t(
            presenter.backupOutcome === 'created'
              ? TRANSLATION_KEYS.settingsVaultBackupSuccess
              : presenter.backupOutcome === 'verified'
                ? TRANSLATION_KEYS.settingsVaultVerified
                : TRANSLATION_KEYS.settingsVaultRestoreSuccess,
          )}
        </p>
      )}
      {presenter.validationState === 'valid' && (
        <p className="settings-vault-status" role="status">
          <CircleCheck aria-hidden="true" size={ICON_SIZE} />
          {t(TRANSLATION_KEYS.settingsVaultValid)}
        </p>
      )}
      {presenter.error !== null && (
        <div className="error-message" role="alert">
          <p>{t(ERROR_TRANSLATION_KEYS[presenter.error.code])}</p>
        </div>
      )}
    </section>
  );
};
