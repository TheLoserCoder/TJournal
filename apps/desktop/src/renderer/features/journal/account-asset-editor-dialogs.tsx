import type { FormEvent, ReactElement } from 'react';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { InstrumentDto } from '../../../shared/desktop-api';
import { Button } from '../../components/ui/button';
import { BUTTON_VARIANTS } from '../../components/ui/button.config';
import { Combobox } from '../../components/ui/combobox';
import { Dialog } from '../../components/ui/dialog';
import { IconButton } from '../../components/ui/icon-button';
import { Select } from '../../components/ui/select';
import { TextField } from '../../components/ui/text-field';
import {
  ERROR_TRANSLATION_KEYS,
  TRANSLATION_KEYS,
  VALIDATION_TRANSLATION_KEYS,
} from '../../i18n-keys';
import {
  DEFAULT_INSTRUMENT_CATEGORY,
  INSTRUMENT_CATEGORIES,
  INSTRUMENT_CATEGORY_LABEL_KEYS,
} from './entity-table.config';
import type { CatalogPresenter } from './use-catalog-presenter';

interface AccountAssetEditorDialogsProps {
  /** Assets ordered by recent trade use, so the picker starts with the last traded ones. */
  readonly assets: readonly InstrumentDto[];
  readonly presenter: CatalogPresenter;
}

interface AssetOption {
  readonly id: string;
  readonly label: string;
}

const AccountForm = ({
  assets,
  presenter,
}: {
  readonly assets: readonly InstrumentDto[];
  readonly presenter: CatalogPresenter;
}): ReactElement => {
  const { t } = useTranslation();
  const account = presenter.editingAccount;
  const draft = presenter.accountDraft;
  const defaultsStatus = presenter.accountDefaultsStatus;
  // Editing an existing account is blocked until its profile list is readable:
  // saving with an unloaded list would replace every stored profile.
  const savingBlocked = account !== null && defaultsStatus !== 'ready';
  const toAssetOptions = (selectedInstrumentId: string): readonly AssetOption[] =>
    assets
      .filter((asset) => asset.archivedAt === null || asset.id === selectedInstrumentId)
      .map((asset) => ({
        id: asset.id,
        label:
          asset.archivedAt === null
            ? asset.symbol
            : `${asset.symbol} (${t(TRANSLATION_KEYS.statusArchived)})`,
      }));
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    await presenter.submitAccountDraft();
  };
  return (
    <form className="entity-editor-form" onSubmit={(event) => void submit(event)}>
      <div className="entity-form-grid">
        <label>
          {t(TRANSLATION_KEYS.fieldAccount)}
          <TextField
            aria-label={t(TRANSLATION_KEYS.fieldAccount)}
            onChange={(event) => presenter.setAccountDraftName(event.target.value)}
            placeholder={t(TRANSLATION_KEYS.fieldAccount)}
            required
            value={draft.name}
          />
        </label>
        <label>
          {t(TRANSLATION_KEYS.fieldAccountOpening)}
          <TextField
            aria-label={t(TRANSLATION_KEYS.fieldAccountOpening)}
            inputMode="decimal"
            onChange={(event) => presenter.setAccountDraftOpening(event.target.value)}
            placeholder={t(TRANSLATION_KEYS.fieldAccountOpening)}
            required
            value={draft.openingBalanceUsd}
          />
        </label>
      </div>
      {presenter.accountError !== null && (
        <div className="error-message" role="alert">
          <p>
            {t(
              presenter.accountError.code === 'validation-invalid'
                ? TRANSLATION_KEYS.accountValidationFailed
                : ERROR_TRANSLATION_KEYS[presenter.accountError.code],
            )}
          </p>
          {presenter.accountError.issues?.map((issue, index) => (
            <p key={`${issue.path}-${index}`}>
              {issue.path === 'openingBalanceUsd'
                ? t(TRANSLATION_KEYS.fieldAccountOpening)
                : issue.path === 'name'
                  ? t(TRANSLATION_KEYS.fieldAccount)
                  : issue.path}
              :{' '}
              {t(
                issue.path === 'openingBalanceUsd' && issue.code === 'invalid_format'
                  ? TRANSLATION_KEYS.accountInvalidOpeningBalance
                  : (VALIDATION_TRANSLATION_KEYS[issue.code] ??
                      TRANSLATION_KEYS.accountValidationFailed),
              )}
            </p>
          ))}
        </div>
      )}
      {account !== null && (
        <fieldset className="entity-defaults-fieldset">
          <legend>{t(TRANSLATION_KEYS.accountCostProfilesTitle)}</legend>
          <p className="entity-defaults-help">{t(TRANSLATION_KEYS.accountCostProfilesHelp)}</p>
          {defaultsStatus === 'loading' && (
            <p className="entity-defaults-help" role="status">
              {t(TRANSLATION_KEYS.accountDefaultsLoading)}
            </p>
          )}
          {defaultsStatus === 'error' && (
            <div className="error-message" role="alert">
              <p>{t(TRANSLATION_KEYS.accountDefaultsLoadFailed)}</p>
              <Button
                onClick={presenter.retryAccountDefaults}
                type="button"
                variant={BUTTON_VARIANTS.secondary}
              >
                {t(TRANSLATION_KEYS.actionRetry)}
              </Button>
            </div>
          )}
          {defaultsStatus === 'ready' && (
            <div className="entity-defaults-editor">
              <div className="entity-defaults-columns" aria-hidden="true">
                <span>{t(TRANSLATION_KEYS.fieldAsset)}</span>
                <span>{t(TRANSLATION_KEYS.fieldCommission)}</span>
                <span>{t(TRANSLATION_KEYS.fieldSpreadTicks)}</span>
                <span>{t(TRANSLATION_KEYS.fieldTickSize)}</span>
                <span>{t(TRANSLATION_KEYS.fieldTickValue)}</span>
                <span />
              </div>
              {draft.defaults.map((item, index) => {
                const assetOptions = toAssetOptions(item.instrumentId);
                return (
                  <div className="entity-default-row" key={`${item.instrumentId}-${index}`}>
                    <Combobox
                      ariaLabel={t(TRANSLATION_KEYS.fieldAsset)}
                      layer="dialog"
                      onChange={(value) => {
                        const selected = assetOptions.find((option) => option.label === value);
                        if (selected === undefined) return;
                        presenter.setAccountDefaultField(index, 'instrumentId', selected.id);
                      }}
                      options={assetOptions.map((option) => option.label)}
                      placeholder={t(TRANSLATION_KEYS.fieldAsset)}
                      value={
                        assetOptions.find((option) => option.id === item.instrumentId)?.label ?? ''
                      }
                    />
                    <TextField
                      aria-label={t(TRANSLATION_KEYS.fieldCommission)}
                      inputMode="decimal"
                      onChange={(event) =>
                        presenter.setAccountDefaultField(index, 'commissionUsd', event.target.value)
                      }
                      placeholder={t(TRANSLATION_KEYS.fieldCommission)}
                      value={item.commissionUsd}
                    />
                    <TextField
                      aria-label={t(TRANSLATION_KEYS.fieldSpreadTicks)}
                      inputMode="decimal"
                      onChange={(event) =>
                        presenter.setAccountDefaultField(index, 'spreadTicks', event.target.value)
                      }
                      placeholder={t(TRANSLATION_KEYS.fieldSpreadTicks)}
                      value={item.spreadTicks}
                    />
                    <TextField
                      aria-label={t(TRANSLATION_KEYS.fieldTickSize)}
                      inputMode="decimal"
                      onChange={(event) =>
                        presenter.setAccountDefaultField(index, 'tickSize', event.target.value)
                      }
                      placeholder={t(TRANSLATION_KEYS.fieldTickSize)}
                      value={item.tickSize}
                    />
                    <TextField
                      aria-label={t(TRANSLATION_KEYS.fieldTickValue)}
                      inputMode="decimal"
                      onChange={(event) =>
                        presenter.setAccountDefaultField(
                          index,
                          'tickValueUsdPerLot',
                          event.target.value,
                        )
                      }
                      placeholder={t(TRANSLATION_KEYS.fieldTickValue)}
                      value={item.tickValueUsdPerLot}
                    />
                    <IconButton
                      label={t(TRANSLATION_KEYS.actionDelete)}
                      onClick={() => presenter.removeAccountDefault(index)}
                    >
                      <Trash2 aria-hidden="true" />
                    </IconButton>
                  </div>
                );
              })}
              <Button
                onClick={presenter.addAccountDefault}
                type="button"
                variant={BUTTON_VARIANTS.secondary}
              >
                {t(TRANSLATION_KEYS.actionAdd)}
              </Button>
            </div>
          )}
        </fieldset>
      )}
      <div className="ui-dialog-actions">
        <Button
          onClick={presenter.closeAccountEditor}
          type="button"
          variant={BUTTON_VARIANTS.secondary}
        >
          {t(TRANSLATION_KEYS.actionCancel)}
        </Button>
        <Button
          disabled={savingBlocked || presenter.accountSaving}
          type="submit"
          variant={BUTTON_VARIANTS.primary}
        >
          {t(TRANSLATION_KEYS.actionSave)}
        </Button>
      </div>
    </form>
  );
};

const AssetForm = ({ presenter }: { readonly presenter: CatalogPresenter }): ReactElement => {
  const { t } = useTranslation();
  const asset = presenter.editingAsset;
  const [symbol, setSymbol] = useState(asset?.symbol ?? '');
  const [category, setCategory] = useState<InstrumentDto['category']>(
    asset?.category ?? DEFAULT_INSTRUMENT_CATEGORY,
  );
  useEffect(() => {
    setSymbol(asset?.symbol ?? '');
    setCategory(asset?.category ?? DEFAULT_INSTRUMENT_CATEGORY);
  }, [asset]);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    // Calculation ticks belong to the account cost profile. An existing legacy
    // instrument profile is passed through unchanged so an asset edit does not
    // erase the fallback values.
    const calculationProfile =
      asset?.calculationProfile === null || asset?.calculationProfile === undefined
        ? null
        : {
            tickSize: asset.calculationProfile.tickSize,
            tickValueUsdPerLot: asset.calculationProfile.tickValueUsdPerLot,
          };
    await presenter.saveAsset({
      ...(asset === null ? {} : { id: asset.id }),
      calculationProfile,
      category,
      symbol,
    });
  };
  return (
    <form className="entity-editor-form" onSubmit={(event) => void submit(event)}>
      <div className="entity-form-grid">
        <label>
          {t(TRANSLATION_KEYS.fieldAsset)}
          <TextField
            aria-label={t(TRANSLATION_KEYS.fieldAsset)}
            onChange={(event) => setSymbol(event.target.value)}
            placeholder={t(TRANSLATION_KEYS.fieldAsset)}
            required
            value={symbol}
          />
        </label>
        <label>
          {t(TRANSLATION_KEYS.fieldCategory)}
          <Select
            ariaLabel={t(TRANSLATION_KEYS.fieldCategory)}
            layer="dialog"
            onValueChange={(value) => setCategory(value as InstrumentDto['category'])}
            options={INSTRUMENT_CATEGORIES.map((value) => ({
              label: t(INSTRUMENT_CATEGORY_LABEL_KEYS[value]),
              value,
            }))}
            placeholder={t(TRANSLATION_KEYS.fieldCategory)}
            value={category}
          />
        </label>
      </div>
      <div className="ui-dialog-actions">
        <Button
          onClick={presenter.closeAssetEditor}
          type="button"
          variant={BUTTON_VARIANTS.secondary}
        >
          {t(TRANSLATION_KEYS.actionCancel)}
        </Button>
        <Button type="submit" variant={BUTTON_VARIANTS.primary}>
          {t(TRANSLATION_KEYS.actionSave)}
        </Button>
      </div>
    </form>
  );
};

/**
 * Account and asset editors live above the workspace pages: the same dialog opens
 * from the Accounts & Assets tables and from a Statistics breakdown row.
 */
export const AccountAssetEditorDialogs = ({
  assets,
  presenter,
}: AccountAssetEditorDialogsProps): ReactElement => {
  const { t } = useTranslation();
  return (
    <>
      {presenter.accountEditorOpen && (
        <Dialog
          closeLabel={t(TRANSLATION_KEYS.actionClose)}
          contentClassName="account-editor-dialog"
          onOpenChange={(open) => !open && presenter.closeAccountEditor()}
          open
          title={
            presenter.editingAccount === null
              ? t(TRANSLATION_KEYS.actionCreate)
              : t(TRANSLATION_KEYS.actionEdit)
          }
        >
          <AccountForm assets={assets} presenter={presenter} />
        </Dialog>
      )}
      {presenter.assetEditorOpen && (
        <Dialog
          closeLabel={t(TRANSLATION_KEYS.actionClose)}
          contentClassName="asset-editor-dialog"
          onOpenChange={(open) => !open && presenter.closeAssetEditor()}
          open
          title={
            presenter.editingAsset === null
              ? t(TRANSLATION_KEYS.actionCreate)
              : t(TRANSLATION_KEYS.actionEdit)
          }
        >
          <AssetForm presenter={presenter} />
        </Dialog>
      )}
    </>
  );
};
