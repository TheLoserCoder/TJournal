import type { LegacyColumnDef } from '@tanstack/react-table/legacy';
import type { FormEvent, ReactElement } from 'react';
import { LayoutPanelTop, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  AccountDto,
  AccountInstrumentDefaultsDto,
  InstrumentDto,
  TableLayoutDto,
} from '../../../shared/desktop-api';
import { PageHeader } from '../../components/page-header';
import { DataTable, type DataTableColumnFilterViewModel } from '../../components/data-table';
import { useDataTableController } from '../../components/use-data-table-controller';
import { Button } from '../../components/ui/button';
import { BUTTON_VARIANTS } from '../../components/ui/button.config';
import { Checkbox } from '../../components/ui/checkbox';
import { IconButton } from '../../components/ui/icon-button';
import { SelectionToolbar } from '../../components/ui/selection-toolbar';
import { Select } from '../../components/ui/select';
import { TextField } from '../../components/ui/text-field';
import { Dialog } from '../../components/ui/dialog';
import { Tooltip } from '../../components/ui/tooltip';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { TableLayoutDialogView } from './table-layout-dialog-view';
import type { AccountsAssetsPresenter } from './use-accounts-assets-presenter';

interface Props {
  readonly accounts: readonly AccountDto[];
  readonly assets: readonly InstrumentDto[];
  readonly presenter: AccountsAssetsPresenter;
}

const ENTITY_TABLE_SIZE_LIMITS = { maximum: 420, minimum: 96 } as const;
const ENTITY_TABLE_MODE = 'compact' as const;
const ENTITY_TABLE_COLUMNS = {
  accounts: [
    { id: 'selection', visible: true, width: 48 },
    { id: 'name', visible: true, width: 220 },
    { id: 'opening', visible: true, width: 150 },
    { id: 'balance', visible: true, width: 180 },
    { id: 'status', visible: true, width: 130 },
  ],
  assets: [
    { id: 'selection', visible: true, width: 48 },
    { id: 'symbol', visible: true, width: 160 },
    { id: 'category', visible: true, width: 140 },
    { id: 'tickSize', visible: true, width: 130 },
    { id: 'tickValue', visible: true, width: 190 },
    { id: 'status', visible: true, width: 130 },
  ],
} as const;

const normalizeEntityOrder =
  (allowed: readonly string[]) => (order: readonly string[] | undefined) => [
    ...allowed.filter((id) => order?.includes(id)),
    ...allowed.filter((id) => !order?.includes(id)),
  ];

const entityVisibility =
  (columns: readonly { readonly id: string; readonly visible: boolean }[]) => () =>
    Object.fromEntries(columns.map((column) => [column.id, column.visible]));

const QuickAccountCreate = ({
  presenter,
}: {
  readonly presenter: AccountsAssetsPresenter;
}): ReactElement => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [openingBalanceUsd, setOpeningBalanceUsd] = useState('');
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    await presenter.saveAccount({ defaults: [], name, openingBalanceUsd });
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
  readonly presenter: AccountsAssetsPresenter;
}): ReactElement => {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useState('');
  const [category, setCategory] = useState<InstrumentDto['category']>('forex');
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    await presenter.saveAsset({ category, symbol });
    setSymbol('');
    setCategory('forex');
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
        options={['forex', 'crypto', 'metal', 'energy', 'index', 'equity', 'etf'].map((value) => ({
          label: value,
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

const AccountForm = ({
  assets,
  presenter,
}: {
  readonly assets: readonly InstrumentDto[];
  readonly presenter: AccountsAssetsPresenter;
}): ReactElement => {
  const { t } = useTranslation();
  const account = presenter.editingAccount;
  const [name, setName] = useState(account?.name ?? '');
  const [opening, setOpening] = useState(account?.openingBalanceUsd ?? '');
  const [defaults, setDefaults] = useState<
    readonly Omit<AccountInstrumentDefaultsDto, 'accountId' | 'updatedAt'>[]
  >([]);
  useEffect(() => {
    setName(account?.name ?? '');
    setOpening(account?.openingBalanceUsd ?? '');
  }, [account]);
  useEffect(() => {
    let active = true;
    if (account === null) {
      setDefaults([]);
      return () => {
        active = false;
      };
    }
    void presenter.loadDefaults(account.id).then((items) => {
      if (active)
        setDefaults(
          items.map((item) => ({
            instrumentId: item.instrumentId,
            commissionUsd: item.commissionUsd,
            spreadTicks: item.spreadTicks,
          })),
        );
    });
    return () => {
      active = false;
    };
    // The presenter is a render-scoped facade; account identity is the fetch key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    await presenter.saveAccount({
      ...(account === null ? {} : { id: account.id }),
      defaults,
      name,
      openingBalanceUsd: opening,
    });
  };
  return (
    <form className="entity-editor-form" onSubmit={(event) => void submit(event)}>
      <div className="entity-form-grid">
        <label>
          {t(TRANSLATION_KEYS.fieldAccount)}
          <TextField
            aria-label={t(TRANSLATION_KEYS.fieldAccount)}
            onChange={(event) => setName(event.target.value)}
            placeholder={t(TRANSLATION_KEYS.fieldAccount)}
            required
            value={name}
          />
        </label>
        <label>
          {t(TRANSLATION_KEYS.fieldAccountOpening)}
          <TextField
            aria-label={t(TRANSLATION_KEYS.fieldAccountOpening)}
            inputMode="decimal"
            onChange={(event) => setOpening(event.target.value)}
            placeholder={t(TRANSLATION_KEYS.fieldAccountOpening)}
            required
            value={opening}
          />
        </label>
      </div>
      {account !== null && (
        <fieldset className="entity-defaults-fieldset">
          <legend>{t(TRANSLATION_KEYS.accountCostProfilesTitle)}</legend>
          <p className="entity-defaults-help">{t(TRANSLATION_KEYS.accountCostProfilesHelp)}</p>
          <div className="entity-defaults-editor">
            <div className="entity-defaults-columns" aria-hidden="true">
              <span>{t(TRANSLATION_KEYS.fieldAsset)}</span>
              <span>{t(TRANSLATION_KEYS.fieldCommission)}</span>
              <span>{t(TRANSLATION_KEYS.fieldSpreadTicks)}</span>
              <span />
            </div>
            {defaults.map((item, index) => (
              <div className="entity-default-row" key={`${item.instrumentId}-${index}`}>
                <Select
                  ariaLabel={t(TRANSLATION_KEYS.fieldAsset)}
                  layer="dialog"
                  onValueChange={(value) =>
                    setDefaults((current) =>
                      current.map((entry, currentIndex) =>
                        currentIndex === index ? { ...entry, instrumentId: value } : entry,
                      ),
                    )
                  }
                  options={assets
                    .filter((asset) => asset.archivedAt === null || asset.id === item.instrumentId)
                    .map((asset) => ({
                      label:
                        asset.archivedAt === null
                          ? asset.symbol
                          : `${asset.symbol} (${t(TRANSLATION_KEYS.statusArchived)})`,
                      value: asset.id,
                    }))}
                  value={item.instrumentId}
                  placeholder={t(TRANSLATION_KEYS.fieldAsset)}
                />
                <TextField
                  aria-label={t(TRANSLATION_KEYS.fieldCommission)}
                  inputMode="decimal"
                  onChange={(event) =>
                    setDefaults((current) =>
                      current.map((entry, currentIndex) =>
                        currentIndex === index
                          ? { ...entry, commissionUsd: event.target.value }
                          : entry,
                      ),
                    )
                  }
                  value={item.commissionUsd}
                  placeholder={t(TRANSLATION_KEYS.fieldCommission)}
                />
                <TextField
                  aria-label={t(TRANSLATION_KEYS.fieldSpreadTicks)}
                  inputMode="decimal"
                  onChange={(event) =>
                    setDefaults((current) =>
                      current.map((entry, currentIndex) =>
                        currentIndex === index
                          ? { ...entry, spreadTicks: event.target.value }
                          : entry,
                      ),
                    )
                  }
                  value={item.spreadTicks}
                  placeholder={t(TRANSLATION_KEYS.fieldSpreadTicks)}
                />
                <IconButton
                  label={t(TRANSLATION_KEYS.actionDelete)}
                  onClick={() =>
                    setDefaults((current) =>
                      current.filter((_entry, currentIndex) => currentIndex !== index),
                    )
                  }
                >
                  <Trash2 aria-hidden="true" />
                </IconButton>
              </div>
            ))}
            <Button
              onClick={() => {
                const first = assets.find(
                  (asset) =>
                    asset.archivedAt === null &&
                    !defaults.some((item) => item.instrumentId === asset.id),
                );
                if (first !== undefined)
                  setDefaults((current) => [
                    ...current,
                    { instrumentId: first.id, commissionUsd: '0', spreadTicks: '0' },
                  ]);
              }}
              type="button"
              variant={BUTTON_VARIANTS.secondaryAccent}
            >
              {t(TRANSLATION_KEYS.actionAdd)}
            </Button>
          </div>
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
        <Button type="submit" variant={BUTTON_VARIANTS.success}>
          {t(TRANSLATION_KEYS.actionSave)}
        </Button>
      </div>
    </form>
  );
};

const AccountsTable = ({
  accounts,
  layout,
  presenter,
  quickCreate,
}: {
  readonly accounts: readonly AccountDto[];
  readonly layout: TableLayoutDto | undefined;
  readonly presenter: AccountsAssetsPresenter;
  readonly quickCreate: ReactElement;
}): ReactElement => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active');
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutColumns, setLayoutColumns] = useState<
    readonly { readonly id: string; readonly label: string; readonly visible: boolean }[]
  >([]);
  const filteredAccounts = useMemo(
    () =>
      accounts.filter((account) =>
        status === 'all'
          ? true
          : status === 'active'
            ? account.archivedAt === null
            : account.archivedAt !== null,
      ),
    [accounts, status],
  );
  const columns = useMemo<readonly LegacyColumnDef<AccountDto>[]>(
    () => [
      {
        enableResizing: false,
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            ariaLabel={t(TRANSLATION_KEYS.tableSelectAll)}
            checked={table.getIsAllRowsSelected()}
            onCheckedChange={(checked) => table.toggleAllRowsSelected(checked)}
          />
        ),
        id: 'selection',
        size: 48,
        cell: ({ row }) => (
          <Checkbox
            ariaLabel={t(TRANSLATION_KEYS.tableSelectRow)}
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked)}
          />
        ),
      },
      { accessorKey: 'name', header: t(TRANSLATION_KEYS.fieldAccount) },
      {
        accessorKey: 'openingBalanceUsd',
        cell: ({ row }) => `${row.original.openingBalanceUsd} ${t(TRANSLATION_KEYS.tradeUnitCash)}`,
        header: t(TRANSLATION_KEYS.fieldAccountOpening),
        id: 'opening',
      },
      {
        cell: ({ row }) => (
          <>
            {row.original.currentKnownBalanceUsd} {t(TRANSLATION_KEYS.tradeUnitCash)}
            {row.original.uncoveredTradeCount > 0 && (
              <span
                aria-label={t(TRANSLATION_KEYS.accountUncoveredWarning, {
                  count: row.original.uncoveredTradeCount,
                })}
                title={t(TRANSLATION_KEYS.accountUncoveredWarning, {
                  count: row.original.uncoveredTradeCount,
                })}
              >
                {' '}
                ⚠ {row.original.uncoveredTradeCount}
              </span>
            )}
          </>
        ),
        header: t(TRANSLATION_KEYS.fieldAccountBalance),
        id: 'balance',
      },
      {
        cell: ({ row }) =>
          row.original.archivedAt === null
            ? t(TRANSLATION_KEYS.statusActive)
            : t(TRANSLATION_KEYS.statusArchived),
        header: t(TRANSLATION_KEYS.fieldStatus),
        id: 'status',
      },
    ],
    [t],
  );
  const controller = useDataTableController({
    columns,
    data: filteredAccounts,
    defaultColumns: ENTITY_TABLE_COLUMNS.accounts,
    defaultMode: ENTITY_TABLE_MODE,
    getColumnsForMode: entityVisibility(ENTITY_TABLE_COLUMNS.accounts),
    getRowId: (account) => account.id,
    isDataColumn: (id) => id !== 'selection',
    layout,
    layoutId: 'accounts',
    normalizeColumnOrder: normalizeEntityOrder(
      ENTITY_TABLE_COLUMNS.accounts.map((column) => column.id),
    ),
    onLayoutChange: presenter.updateTableLayout,
    sizeLimits: ENTITY_TABLE_SIZE_LIMITS,
  });
  const filters: readonly DataTableColumnFilterViewModel[] = [
    {
      active: status !== 'active',
      columnId: 'status',
      content: (
        <Select
          ariaLabel={t(TRANSLATION_KEYS.fieldStatus)}
          onValueChange={(value) => setStatus(value as 'active' | 'archived' | 'all')}
          options={[
            { label: t(TRANSLATION_KEYS.statusActive), value: 'active' },
            { label: t(TRANSLATION_KEYS.statusArchived), value: 'archived' },
            { label: t(TRANSLATION_KEYS.tableResultAll), value: 'all' },
          ]}
          value={status}
        />
      ),
      expanded: controller.activeFilterColumnId === 'status',
      label: t(TRANSLATION_KEYS.fieldStatus),
      onOpenChange: (open) => controller.setActiveFilter(open ? 'status' : null),
    },
  ];
  const selected = controller.selectedRows;
  const selectedActive = selected.filter((account) => account.archivedAt === null);
  const selectedArchived = selected.filter((account) => account.archivedAt !== null);
  const openLayout = (): void => {
    setLayoutColumns(controller.columnControls);
    setLayoutOpen(true);
  };
  return (
    <>
      <div className="entities-toolbar" data-selection-active={selected.length > 0}>
        <div className="entities-quick-create-slot">{quickCreate}</div>
        <SelectionToolbar
          label={
            selected.length > 0
              ? t(TRANSLATION_KEYS.tableSelectedCount, { count: selected.length })
              : undefined
          }
        >
          <div className="table-selection-actions entity-table-selection-actions">
            {selected.length > 0 ? (
              <span>{t(TRANSLATION_KEYS.tableSelectedCount, { count: selected.length })}</span>
            ) : (
              <span aria-hidden="true" />
            )}
            <Tooltip content={t(TRANSLATION_KEYS.actionClearSelection)}>
              <IconButton
                className={selected.length > 0 ? '' : 'is-hidden'}
                disabled={selected.length === 0}
                label={t(TRANSLATION_KEYS.actionClearSelection)}
                onClick={controller.clearSelection}
              >
                <X aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content={t(TRANSLATION_KEYS.actionEdit)}>
              <IconButton
                className={selected.length === 1 ? '' : 'is-hidden'}
                disabled={selected.length !== 1}
                label={t(TRANSLATION_KEYS.actionEdit)}
                onClick={() => selected[0] !== undefined && presenter.editAccount(selected[0])}
                variant="edit"
              >
                <Pencil aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content={t(TRANSLATION_KEYS.actionDeleteSelected)}>
              <IconButton
                className={selectedActive.length > 0 ? '' : 'is-hidden'}
                disabled={selectedActive.length === 0}
                label={t(TRANSLATION_KEYS.actionDeleteSelected)}
                onClick={() => {
                  void Promise.all(
                    selectedActive.map((account) => presenter.deleteAccount(account.id)),
                  ).then(controller.clearSelection);
                }}
                variant="danger"
              >
                <Trash2 aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content={t(TRANSLATION_KEYS.actionRestore)}>
              <IconButton
                className={selectedArchived.length > 0 ? '' : 'is-hidden'}
                disabled={selectedArchived.length === 0}
                label={t(TRANSLATION_KEYS.actionRestore)}
                onClick={() => {
                  void Promise.all(
                    selectedArchived.map((account) => presenter.restoreAccount(account.id)),
                  ).then(controller.clearSelection);
                }}
              >
                <RotateCcw aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content={t(TRANSLATION_KEYS.tableLayout)}>
              <IconButton label={t(TRANSLATION_KEYS.tableLayout)} onClick={openLayout}>
                <LayoutPanelTop aria-hidden="true" />
              </IconButton>
            </Tooltip>
          </div>
        </SelectionToolbar>
      </div>
      <DataTable
        emptyMessage={t(TRANSLATION_KEYS.tableEmpty)}
        filters={filters}
        resizeColumnLabel={t(TRANSLATION_KEYS.tableResizeColumn)}
        sortColumnLabel={t(TRANSLATION_KEYS.tableSortColumn)}
        table={controller.table}
      />
      {layoutOpen && (
        <TableLayoutDialogView
          applyLabel={t(TRANSLATION_KEYS.actionApply)}
          cancelLabel={t(TRANSLATION_KEYS.actionCancel)}
          closeLabel={t(TRANSLATION_KEYS.actionClose)}
          columns={layoutColumns}
          onApply={() => {
            controller.applyLayout(controller.mode, layoutColumns);
            setLayoutOpen(false);
          }}
          onClose={() => setLayoutOpen(false)}
          onToggleColumn={(id) =>
            setLayoutColumns((current) =>
              current.map((column) =>
                column.id === id ? { ...column, visible: !column.visible } : column,
              ),
            )
          }
          title={t(TRANSLATION_KEYS.tableLayout)}
        />
      )}
    </>
  );
};

const AssetForm = ({
  presenter,
}: {
  readonly presenter: AccountsAssetsPresenter;
}): ReactElement => {
  const { t } = useTranslation();
  const asset = presenter.editingAsset;
  const [symbol, setSymbol] = useState(asset?.symbol ?? '');
  const [category, setCategory] = useState<InstrumentDto['category']>(asset?.category ?? 'forex');
  const [tickSize, setTickSize] = useState(asset?.calculationProfile?.tickSize ?? '');
  const [tickValue, setTickValue] = useState(asset?.calculationProfile?.tickValueUsdPerLot ?? '');
  useEffect(() => {
    setSymbol(asset?.symbol ?? '');
    setCategory(asset?.category ?? 'forex');
    setTickSize(asset?.calculationProfile?.tickSize ?? '');
    setTickValue(asset?.calculationProfile?.tickValueUsdPerLot ?? '');
  }, [asset]);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const calculationProfile =
      tickSize.trim() === '' && tickValue.trim() === ''
        ? null
        : { tickSize, tickValueUsdPerLot: tickValue };
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
            options={['forex', 'crypto', 'metal', 'energy', 'index', 'equity', 'etf'].map(
              (value) => ({ label: value, value }),
            )}
            placeholder={t(TRANSLATION_KEYS.fieldCategory)}
            value={category}
          />
        </label>
        <label>
          {t(TRANSLATION_KEYS.fieldTickSize)}
          <TextField
            aria-label={t(TRANSLATION_KEYS.fieldTickSize)}
            inputMode="decimal"
            onChange={(event) => setTickSize(event.target.value)}
            placeholder={t(TRANSLATION_KEYS.fieldTickSize)}
            value={tickSize}
          />
        </label>
        <label>
          {t(TRANSLATION_KEYS.fieldTickValue)}
          <TextField
            aria-label={t(TRANSLATION_KEYS.fieldTickValue)}
            inputMode="decimal"
            onChange={(event) => setTickValue(event.target.value)}
            placeholder={t(TRANSLATION_KEYS.fieldTickValue)}
            value={tickValue}
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
        <Button type="submit" variant={BUTTON_VARIANTS.success}>
          {t(TRANSLATION_KEYS.actionSave)}
        </Button>
      </div>
    </form>
  );
};

const AssetsTable = ({
  assets,
  layout,
  presenter,
  quickCreate,
}: {
  readonly assets: readonly InstrumentDto[];
  readonly layout: TableLayoutDto | undefined;
  readonly presenter: AccountsAssetsPresenter;
  readonly quickCreate: ReactElement;
}): ReactElement => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active');
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutColumns, setLayoutColumns] = useState<
    readonly { readonly id: string; readonly label: string; readonly visible: boolean }[]
  >([]);
  const filteredAssets = useMemo(
    () =>
      assets.filter((asset) =>
        status === 'all'
          ? true
          : status === 'active'
            ? asset.archivedAt === null
            : asset.archivedAt !== null,
      ),
    [assets, status],
  );
  const columns = useMemo<readonly LegacyColumnDef<InstrumentDto>[]>(
    () => [
      {
        enableResizing: false,
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            ariaLabel={t(TRANSLATION_KEYS.tableSelectAll)}
            checked={table.getIsAllRowsSelected()}
            onCheckedChange={(checked) => table.toggleAllRowsSelected(checked)}
          />
        ),
        id: 'selection',
        size: 48,
        cell: ({ row }) => (
          <Checkbox
            ariaLabel={t(TRANSLATION_KEYS.tableSelectRow)}
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked)}
          />
        ),
      },
      { accessorKey: 'symbol', header: t(TRANSLATION_KEYS.fieldAsset) },
      { accessorKey: 'category', header: t(TRANSLATION_KEYS.fieldCategory) },
      {
        cell: ({ row }) => row.original.calculationProfile?.tickSize ?? '—',
        header: t(TRANSLATION_KEYS.fieldTickSize),
        id: 'tickSize',
      },
      {
        cell: ({ row }) => row.original.calculationProfile?.tickValueUsdPerLot ?? '—',
        header: t(TRANSLATION_KEYS.fieldTickValue),
        id: 'tickValue',
      },
      {
        cell: ({ row }) =>
          row.original.archivedAt === null
            ? t(TRANSLATION_KEYS.statusActive)
            : t(TRANSLATION_KEYS.statusArchived),
        header: t(TRANSLATION_KEYS.fieldStatus),
        id: 'status',
      },
    ],
    [t],
  );
  const controller = useDataTableController({
    columns,
    data: filteredAssets,
    defaultColumns: ENTITY_TABLE_COLUMNS.assets,
    defaultMode: ENTITY_TABLE_MODE,
    getColumnsForMode: entityVisibility(ENTITY_TABLE_COLUMNS.assets),
    getRowId: (asset) => asset.id,
    isDataColumn: (id) => id !== 'selection',
    layout,
    layoutId: 'assets',
    normalizeColumnOrder: normalizeEntityOrder(
      ENTITY_TABLE_COLUMNS.assets.map((column) => column.id),
    ),
    onLayoutChange: presenter.updateTableLayout,
    sizeLimits: ENTITY_TABLE_SIZE_LIMITS,
  });
  const filters: readonly DataTableColumnFilterViewModel[] = [
    {
      active: status !== 'active',
      columnId: 'status',
      content: (
        <Select
          ariaLabel={t(TRANSLATION_KEYS.fieldStatus)}
          onValueChange={(value) => setStatus(value as 'active' | 'archived' | 'all')}
          options={[
            { label: t(TRANSLATION_KEYS.statusActive), value: 'active' },
            { label: t(TRANSLATION_KEYS.statusArchived), value: 'archived' },
            { label: t(TRANSLATION_KEYS.tableResultAll), value: 'all' },
          ]}
          value={status}
        />
      ),
      expanded: controller.activeFilterColumnId === 'status',
      label: t(TRANSLATION_KEYS.fieldStatus),
      onOpenChange: (open) => controller.setActiveFilter(open ? 'status' : null),
    },
  ];
  const selected = controller.selectedRows;
  const selectedActive = selected.filter((asset) => asset.archivedAt === null);
  const selectedArchived = selected.filter((asset) => asset.archivedAt !== null);
  const openLayout = (): void => {
    setLayoutColumns(controller.columnControls);
    setLayoutOpen(true);
  };
  return (
    <>
      <div className="entities-toolbar" data-selection-active={selected.length > 0}>
        <div className="entities-quick-create-slot">{quickCreate}</div>
        <SelectionToolbar
          label={
            selected.length > 0
              ? t(TRANSLATION_KEYS.tableSelectedCount, { count: selected.length })
              : undefined
          }
        >
          <div className="table-selection-actions entity-table-selection-actions">
            {selected.length > 0 ? (
              <span>{t(TRANSLATION_KEYS.tableSelectedCount, { count: selected.length })}</span>
            ) : (
              <span aria-hidden="true" />
            )}
            <Tooltip content={t(TRANSLATION_KEYS.actionClearSelection)}>
              <IconButton
                className={selected.length > 0 ? '' : 'is-hidden'}
                disabled={selected.length === 0}
                label={t(TRANSLATION_KEYS.actionClearSelection)}
                onClick={controller.clearSelection}
              >
                <X aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content={t(TRANSLATION_KEYS.actionEdit)}>
              <IconButton
                className={selected.length === 1 ? '' : 'is-hidden'}
                disabled={selected.length !== 1}
                label={t(TRANSLATION_KEYS.actionEdit)}
                onClick={() => selected[0] !== undefined && presenter.editAsset(selected[0])}
                variant="edit"
              >
                <Pencil aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content={t(TRANSLATION_KEYS.actionDeleteSelected)}>
              <IconButton
                className={selectedActive.length > 0 ? '' : 'is-hidden'}
                disabled={selectedActive.length === 0}
                label={t(TRANSLATION_KEYS.actionDeleteSelected)}
                onClick={() => {
                  void Promise.all(
                    selectedActive.map((asset) => presenter.deleteAsset(asset.id)),
                  ).then(controller.clearSelection);
                }}
                variant="danger"
              >
                <Trash2 aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content={t(TRANSLATION_KEYS.actionRestore)}>
              <IconButton
                className={selectedArchived.length > 0 ? '' : 'is-hidden'}
                disabled={selectedArchived.length === 0}
                label={t(TRANSLATION_KEYS.actionRestore)}
                onClick={() => {
                  void Promise.all(
                    selectedArchived.map((asset) => presenter.restoreAsset(asset.id)),
                  ).then(controller.clearSelection);
                }}
              >
                <RotateCcw aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content={t(TRANSLATION_KEYS.tableLayout)}>
              <IconButton label={t(TRANSLATION_KEYS.tableLayout)} onClick={openLayout}>
                <LayoutPanelTop aria-hidden="true" />
              </IconButton>
            </Tooltip>
          </div>
        </SelectionToolbar>
      </div>
      <DataTable
        emptyMessage={t(TRANSLATION_KEYS.tableEmpty)}
        filters={filters}
        resizeColumnLabel={t(TRANSLATION_KEYS.tableResizeColumn)}
        sortColumnLabel={t(TRANSLATION_KEYS.tableSortColumn)}
        table={controller.table}
      />
      {layoutOpen && (
        <TableLayoutDialogView
          applyLabel={t(TRANSLATION_KEYS.actionApply)}
          cancelLabel={t(TRANSLATION_KEYS.actionCancel)}
          closeLabel={t(TRANSLATION_KEYS.actionClose)}
          columns={layoutColumns}
          onApply={() => {
            controller.applyLayout(controller.mode, layoutColumns);
            setLayoutOpen(false);
          }}
          onClose={() => setLayoutOpen(false)}
          onToggleColumn={(id) =>
            setLayoutColumns((current) =>
              current.map((column) =>
                column.id === id ? { ...column, visible: !column.visible } : column,
              ),
            )
          }
          title={t(TRANSLATION_KEYS.tableLayout)}
        />
      )}
    </>
  );
};

export const AccountsAssetsPageView = ({ accounts, assets, presenter }: Props): ReactElement => {
  const { t } = useTranslation();
  return (
    <section className="entities-workspace">
      <PageHeader title={t(TRANSLATION_KEYS.navigationAccountsAssets)} />
      <div className="entities-tabs">
        <Button
          onClick={() => presenter.setTab('accounts')}
          type="button"
          variant={
            presenter.tab === 'accounts' ? BUTTON_VARIANTS.primary : BUTTON_VARIANTS.secondary
          }
        >
          {t(TRANSLATION_KEYS.accountsTab)}
        </Button>
        <Button
          onClick={() => presenter.setTab('assets')}
          type="button"
          variant={presenter.tab === 'assets' ? BUTTON_VARIANTS.primary : BUTTON_VARIANTS.secondary}
        >
          {t(TRANSLATION_KEYS.assetsTab)}
        </Button>
      </div>
      {presenter.tab === 'accounts' ? (
        <>
          <AccountsTable
            accounts={accounts}
            layout={presenter.accountsLayout}
            presenter={presenter}
            quickCreate={<QuickAccountCreate presenter={presenter} />}
          />
          {presenter.accountEditorOpen && (
            <Dialog
              closeLabel={t(TRANSLATION_KEYS.actionClose)}
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
        </>
      ) : (
        <>
          <AssetsTable
            assets={assets}
            layout={presenter.assetsLayout}
            presenter={presenter}
            quickCreate={<QuickAssetCreate presenter={presenter} />}
          />
          {presenter.assetEditorOpen && (
            <Dialog
              closeLabel={t(TRANSLATION_KEYS.actionClose)}
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
      )}
    </section>
  );
};
