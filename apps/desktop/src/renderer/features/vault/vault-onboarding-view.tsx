import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/ui/button';
import { BUTTON_VARIANTS } from '../../components/ui/button.config';
import { Dialog } from '../../components/ui/dialog';
import { ERROR_TRANSLATION_KEYS, TRANSLATION_KEYS } from '../../i18n-keys';
import type { JournalPresenter } from '../journal/use-journal-presenter';

type VaultAction = 'create' | 'open';

export const VaultOnboardingView = ({
  presenter,
}: {
  readonly presenter: JournalPresenter;
}): ReactElement => {
  const { t } = useTranslation();
  const [pendingAction, setPendingAction] = useState<VaultAction | null>(null);

  const run = async (action: VaultAction): Promise<void> => {
    setPendingAction(action);
    try {
      if (action === 'create') await presenter.createVault();
      else await presenter.openVault();
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <main className="app-shell">
      <Dialog
        closeLabel={t(TRANSLATION_KEYS.actionClose)}
        dismissible={false}
        onOpenChange={() => undefined}
        open
        title={t(TRANSLATION_KEYS.vaultOnboardingTitle)}
      >
        <p>{t(TRANSLATION_KEYS.vaultOnboardingDescription)}</p>
        {presenter.vaultError !== null && (
          <div className="error-message">
            <p>{t(ERROR_TRANSLATION_KEYS[presenter.vaultError.code])}</p>
          </div>
        )}
        <div className="ui-dialog-actions">
          <Button
            disabled={pendingAction !== null}
            onClick={() => void run('create')}
            type="button"
            variant={BUTTON_VARIANTS.primary}
          >
            {t(TRANSLATION_KEYS.vaultOnboardingCreate)}
          </Button>
          <Button
            disabled={pendingAction !== null}
            onClick={() => void run('open')}
            type="button"
            variant={BUTTON_VARIANTS.secondary}
          >
            {t(TRANSLATION_KEYS.vaultOnboardingOpen)}
          </Button>
        </div>
      </Dialog>
    </main>
  );
};
