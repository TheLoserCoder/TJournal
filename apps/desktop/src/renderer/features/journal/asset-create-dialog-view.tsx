import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import type { InstrumentCategory } from '../../../shared/desktop-api';
import { Button } from '../../components/ui/button';
import { BUTTON_VARIANTS } from '../../components/ui/button.config';
import { Dialog } from '../../components/ui/dialog';
import { Select } from '../../components/ui/select';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { INSTRUMENT_CATEGORIES, INSTRUMENT_CATEGORY_LABEL_KEYS } from './entity-table.config';

interface AssetCreateDialogViewProps {
  readonly category: InstrumentCategory;
  readonly onCancel: () => void;
  readonly onCategoryChange: (value: InstrumentCategory) => void;
  readonly onConfirm: () => void;
  readonly symbol: string;
}

/**
 * Create-asset prompt opened from quick entry when the typed symbol is not in
 * the catalog. The type is chosen here, so a new asset never silently becomes
 * a forex instrument.
 */
export const AssetCreateDialogView = ({
  category,
  onCancel,
  onCategoryChange,
  onConfirm,
  symbol,
}: AssetCreateDialogViewProps): ReactElement => {
  const { t } = useTranslation();
  return (
    <Dialog
      closeLabel={t(TRANSLATION_KEYS.actionClose)}
      onOpenChange={(open) => !open && onCancel()}
      open
      title={t(TRANSLATION_KEYS.assetCreateTitle)}
    >
      <form
        className="entity-editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <p>{t(TRANSLATION_KEYS.assetCreateConfirmation, { symbol })}</p>
        <label>
          {t(TRANSLATION_KEYS.fieldAssetType)}
          <Select
            ariaLabel={t(TRANSLATION_KEYS.fieldAssetType)}
            layer="dialog"
            onValueChange={(value) => onCategoryChange(value as InstrumentCategory)}
            options={INSTRUMENT_CATEGORIES.map((value) => ({
              label: t(INSTRUMENT_CATEGORY_LABEL_KEYS[value]),
              value,
            }))}
            placeholder={t(TRANSLATION_KEYS.fieldAssetType)}
            value={category}
          />
        </label>
        <div className="ui-dialog-actions">
          <Button onClick={onCancel} type="button" variant={BUTTON_VARIANTS.secondary}>
            {t(TRANSLATION_KEYS.actionCancel)}
          </Button>
          <Button type="submit" variant={BUTTON_VARIANTS.primary}>
            {t(TRANSLATION_KEYS.actionCreate)}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
