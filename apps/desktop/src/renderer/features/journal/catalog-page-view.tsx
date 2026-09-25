import type { FormEvent, ReactElement } from 'react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AccountDto, InstrumentDto } from '../../../shared/desktop-api';
import { PageHeader } from '../../components/page-header';
import { Button } from '../../components/ui/button';
import { BUTTON_VARIANTS } from '../../components/ui/button.config';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Select } from '../../components/ui/select';
import { TabList } from '../../components/ui/tab-list';
import { TextField } from '../../components/ui/text-field';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { AccountsTable } from './accounts-table-view';
import { AssetsTable } from './assets-table-view';
import {
  DEFAULT_INSTRUMENT_CATEGORY,
  INSTRUMENT_CATEGORIES,
  INSTRUMENT_CATEGORY_LABEL_KEYS,
} from './entity-table.config';
import { TagsTable, type TagTableRow } from './tags-table-view';
import type { CatalogPresenter } from './use-catalog-presenter';

interface Props {
  readonly accounts: readonly AccountDto[];
  readonly assets: readonly InstrumentDto[];
  readonly presenter: CatalogPresenter;
  readonly tags: readonly TagTableRow[];
}

const QuickAccountCreate = ({
  presenter,
}: {
  readonly presenter: CatalogPresenter;
}): ReactElement => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [openingBalanceUsd, setOpeningBalanceUsd] = useState('');
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const saved = await presenter.saveAccount({ defaults: [], name, openingBalanceUsd });
    if (!saved) return;
    setName('');
    setOpeningBalanceUsd('');
  };
  return (
    <form className="entities-quick-create" onSubmit={(event) => void submit(event)}>
      <TextField
        aria-label={t(TRANSLATION_KEYS.fieldAccount)}
        onChange={(event) => setName(event.target.value)}
        placeholder={t(TRANSLATION_KEYS.fieldAccount)}
        required
        value={name}
      />
      <TextField
        aria-label={t(TRANSLATION_KEYS.fieldAccountOpening)}
        inputMode="decimal"
        onChange={(event) => setOpeningBalanceUsd(event.target.value)}
        placeholder={t(TRANSLATION_KEYS.fieldAccountOpening)}
        required
        value={openingBalanceUsd}
      />
      <Button type="submit" variant={BUTTON_VARIANTS.primary}>
        <Plus aria-hidden="true" />
        {t(TRANSLATION_KEYS.actionAdd)}
      </Button>
      <Button
        onClick={() => presenter.openAccountEditor()}
        type="button"
        variant={BUTTON_VARIANTS.secondary}
      >
        {t(TRANSLATION_KEYS.actionCreate)}
      </Button>
    </form>
  );
};

const QuickAssetCreate = ({
  presenter,
}: {
  readonly presenter: CatalogPresenter;
}): ReactElement => {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useState('');
  const [category, setCategory] = useState<InstrumentDto['category']>(DEFAULT_INSTRUMENT_CATEGORY);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const saved = await presenter.saveAsset({ category, symbol });
    if (!saved) return;
    setSymbol('');
    setCategory(DEFAULT_INSTRUMENT_CATEGORY);
  };
  return (
    <form className="entities-quick-create" onSubmit={(event) => void submit(event)}>
      <TextField
        aria-label={t(TRANSLATION_KEYS.fieldAsset)}
        onChange={(event) => setSymbol(event.target.value)}
        placeholder={t(TRANSLATION_KEYS.fieldAsset)}
        required
        value={symbol}
      />
      <Select
        ariaLabel={t(TRANSLATION_KEYS.fieldCategory)}
        onValueChange={(value) => setCategory(value as InstrumentDto['category'])}
        options={INSTRUMENT_CATEGORIES.map((value) => ({
          label: t(INSTRUMENT_CATEGORY_LABEL_KEYS[value]),
          value,
        }))}
        placeholder={t(TRANSLATION_KEYS.fieldCategory)}
        value={category}
      />
      <Button type="submit" variant={BUTTON_VARIANTS.primary}>
        <Plus aria-hidden="true" />
        {t(TRANSLATION_KEYS.actionAdd)}
      </Button>
      <Button
        onClick={() => presenter.openAssetEditor()}
        type="button"
        variant={BUTTON_VARIANTS.secondary}
      >
        {t(TRANSLATION_KEYS.actionCreate)}
      </Button>
    </form>
  );
};

/** Quick tag creation sends only the name; the domain assigns the colour. */
const QuickTagCreate = ({ presenter }: { readonly presenter: CatalogPresenter }): ReactElement => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const saved = await presenter.saveTag({ name });
    if (!saved) return;
    setName('');
  };
  return (
    <form className="entities-quick-create" onSubmit={(event) => void submit(event)}>
      <TextField
        aria-label={t(TRANSLATION_KEYS.fieldTag)}
        onChange={(event) => setName(event.target.value)}
        placeholder={t(TRANSLATION_KEYS.tagNamePlaceholder)}
        required
        value={name}
      />
      <Button type="submit" variant={BUTTON_VARIANTS.primary}>
        <Plus aria-hidden="true" />
        {t(TRANSLATION_KEYS.actionAdd)}
      </Button>
      <Button
        onClick={() => presenter.openTagEditor()}
        type="button"
        variant={BUTTON_VARIANTS.secondary}
      >
        {t(TRANSLATION_KEYS.actionCreate)}
      </Button>
    </form>
  );
};

export const CatalogPageView = ({ accounts, assets, presenter, tags }: Props): ReactElement => {
  const { t } = useTranslation();
  const categoryOptions = INSTRUMENT_CATEGORIES.map((category) => ({
    id: category,
    label: t(INSTRUMENT_CATEGORY_LABEL_KEYS[category]),
  }));
  const pending = presenter.pendingOperation;
  const pendingTotal = pending === null ? 0 : pending.completedCount + pending.remainingIds.length;
  const confirmingDelete =
    pending !== null && pending.action === 'delete' && pending.completedCount === 0;
  return (
    <section className="entities-workspace">
      <PageHeader title={t(TRANSLATION_KEYS.navigationAccountsAssets)} />
      <TabList
        activeId={presenter.tab}
        ariaLabel={t(TRANSLATION_KEYS.navigationAccountsAssets)}
        onSelect={(id) => presenter.setTab(id as typeof presenter.tab)}
        tabs={[
          { id: 'accounts', label: t(TRANSLATION_KEYS.accountsTab) },
          { id: 'assets', label: t(TRANSLATION_KEYS.assetsTab) },
          { id: 'tags', label: t(TRANSLATION_KEYS.tagsTab) },
        ]}
      />
      {presenter.tab === 'accounts' ? (
        <AccountsTable
          accounts={accounts}
          layout={presenter.accountsLayout}
          presenter={presenter}
          quickCreate={<QuickAccountCreate presenter={presenter} />}
        />
      ) : presenter.tab === 'assets' ? (
        <AssetsTable
          assets={assets}
          categoryOptions={categoryOptions}
          layout={presenter.assetsLayout}
          presenter={presenter}
          quickCreate={<QuickAssetCreate presenter={presenter} />}
        />
      ) : (
        <TagsTable
          layout={presenter.tagsLayout}
          presenter={presenter}
          quickCreate={<QuickTagCreate presenter={presenter} />}
          rows={tags}
        />
      )}
      {pending !== null && (
        <ConfirmDialog
          busy={presenter.bulkBusy}
          cancelLabel={t(TRANSLATION_KEYS.actionCancel)}
          closeLabel={t(TRANSLATION_KEYS.actionClose)}
          confirmLabel={t(
            confirmingDelete ? TRANSLATION_KEYS.actionDelete : TRANSLATION_KEYS.actionRetry,
          )}
          message={
            confirmingDelete
              ? t(TRANSLATION_KEYS.catalogDeleteConfirmation, { count: pendingTotal })
              : t(TRANSLATION_KEYS.catalogBulkProgress, {
                  completed: pending.completedCount,
                  total: pendingTotal,
                })
          }
          onCancel={presenter.cancelPendingOperation}
          onConfirm={presenter.confirmPendingOperation}
          title={t(
            pending.action === 'restore'
              ? TRANSLATION_KEYS.actionRestore
              : TRANSLATION_KEYS.actionDeleteSelected,
          )}
        />
      )}
    </section>
  );
};
