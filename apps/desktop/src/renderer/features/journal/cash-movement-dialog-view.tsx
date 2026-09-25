import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  AccountDto,
  CashMovementDto,
  UpdateCashMovementDto,
} from '../../../shared/desktop-api';
import { Button } from '../../components/ui/button';
import { BUTTON_VARIANTS } from '../../components/ui/button.config';
import { Dialog } from '../../components/ui/dialog';
import { Select } from '../../components/ui/select';
import { TextField } from '../../components/ui/text-field';
import { TRANSLATION_KEYS } from '../../i18n-keys';

interface CashMovementDialogViewProps {
  readonly accounts: readonly AccountDto[];
  readonly movement: CashMovementDto;
  readonly onClose: () => void;
  /** `true` keeps the dialog open: a rejected save must not lose the draft. */
  readonly onSubmit: (input: UpdateCashMovementDto) => Promise<boolean>;
}

/**
 * Deposit/withdrawal editor opened from the row selection or a row double-click.
 * The draft is local, so an abandoned edit never changes the table row.
 */
export const CashMovementDialogView = ({
  accounts,
  movement,
  onClose,
  onSubmit,
}: CashMovementDialogViewProps): ReactElement => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(movement);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (await onSubmit(draft)) onClose();
  };
  return (
    <Dialog
      closeLabel={t(TRANSLATION_KEYS.actionClose)}
      onOpenChange={(open) => !open && onClose()}
      open
      title={t(TRANSLATION_KEYS.tableCashMovements)}
    >
      <form className="entity-editor-form" onSubmit={(event) => void submit(event)}>
        <label>
          {t(TRANSLATION_KEYS.fieldAccount)}
          <Select
            ariaLabel={t(TRANSLATION_KEYS.fieldAccount)}
            layer="dialog"
            onValueChange={(value) => setDraft((current) => ({ ...current, accountId: value }))}
            options={accounts
              .filter((account) => account.archivedAt === null || account.id === draft.accountId)
              .map((account) => ({ label: account.name, value: account.id }))}
            value={draft.accountId}
          />
        </label>
        <label>
          {t(TRANSLATION_KEYS.fieldResult)}
          <TextField
            aria-label={t(TRANSLATION_KEYS.fieldResult)}
            inputMode="decimal"
            onChange={(event) =>
              setDraft((current) => ({ ...current, amountUsd: event.target.value }))
            }
            value={draft.amountUsd}
          />
        </label>
        <Select
          ariaLabel={t(TRANSLATION_KEYS.tableEntryType)}
          layer="dialog"
          onValueChange={(value) =>
            setDraft((current) => ({ ...current, kind: value as CashMovementDto['kind'] }))
          }
          options={[
            { label: t(TRANSLATION_KEYS.accountDeposit), value: 'deposit' },
            { label: t(TRANSLATION_KEYS.accountWithdrawal), value: 'withdrawal' },
          ]}
          value={draft.kind}
        />
        <div className="ui-dialog-actions">
          <Button onClick={onClose} type="button" variant={BUTTON_VARIANTS.secondary}>
            {t(TRANSLATION_KEYS.actionCancel)}
          </Button>
          <Button type="submit" variant={BUTTON_VARIANTS.primary}>
            {t(TRANSLATION_KEYS.actionSave)}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
