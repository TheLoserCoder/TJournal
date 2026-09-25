import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/ui/button';
import { BUTTON_VARIANTS } from '../../components/ui/button.config';
import { TRANSLATION_KEYS } from '../../i18n-keys';

interface LegacyAccountWarningProps {
  readonly lookupEmpty: boolean;
  readonly onReview: () => void;
  readonly unassignedCount: number;
}

/** Accountless legacy trades are excluded from balances; this is their review entry point. */
export const LegacyAccountWarning = ({
  lookupEmpty,
  onReview,
  unassignedCount,
}: LegacyAccountWarningProps): ReactElement | null => {
  const { t } = useTranslation();
  if (unassignedCount === 0) return null;
  return (
    <div className="legacy-account-warning">
      <p className="form-help">{t(TRANSLATION_KEYS.accountLegacyWarning)}</p>
      <Button onClick={onReview} type="button" variant={BUTTON_VARIANTS.secondary}>
        {t(TRANSLATION_KEYS.accountLegacyReview)}
      </Button>
      {lookupEmpty && (
        <p className="form-help" role="status">
          {t(TRANSLATION_KEYS.accountLegacyUnavailable)}
        </p>
      )}
    </div>
  );
};
