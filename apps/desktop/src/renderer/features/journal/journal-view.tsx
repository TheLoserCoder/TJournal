import type { FormEvent, ReactElement } from 'react';
import { BarChart3, Palette, Redo2, Settings, Table2, Undo2, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { suggestTagColor } from '@tjournal/tag/palette';
import { MAX_TRADE_NOTE_CODE_POINTS } from '@tjournal/trade/note-rules';

import type { SafeErrorDto } from '../../../shared/desktop-api';
import { PageHeader } from '../../components/page-header';
import { Button } from '../../components/ui/button';
import { BUTTON_VARIANTS } from '../../components/ui/button.config';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Dialog } from '../../components/ui/dialog';
import { IconButton } from '../../components/ui/icon-button';
import { Select, type SelectOption } from '../../components/ui/select';
import { TextField } from '../../components/ui/text-field';
import { Tooltip } from '../../components/ui/tooltip';
import {
  ERROR_TRANSLATION_KEYS,
  TRANSLATION_KEYS,
  VALIDATION_TRANSLATION_KEYS,
} from '../../i18n-keys';
import { TradesPageView } from './trades-page-view';
import { AccountAssetEditorDialogs } from './account-asset-editor-dialogs';
import { AssetCreateDialogView } from './asset-create-dialog-view';
import { TableLayoutDialogView } from './table-layout-dialog-view';
import { TradeDetailsDialogView } from './trade-details-dialog-view';
import { TradeSummarySettingsDialogView } from './trade-summary-settings-dialog-view';
import { VaultSettingsView } from './vault-settings-view';
import type { JournalWorkspacePresenter } from './use-journal-workspace-presenter';
import { CatalogPageView } from './catalog-page-view';
import { TagEditorDialogView } from './tag-editor-dialog-view';
import { StatisticsPageView } from '../statistics';

const AccountOnboardingDialog = ({
  error,
  onCreate,
}: {
  readonly error: SafeErrorDto | null;
  readonly onCreate: (input: {
    readonly name: string;
    readonly openingBalanceUsd: string;
  }) => Promise<void>;
}): ReactElement => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [openingBalanceUsd, setOpeningBalanceUsd] = useState('0');
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    await onCreate({ name, openingBalanceUsd });
  };
  return (
    <Dialog
      closeLabel={t(TRANSLATION_KEYS.actionClose)}
      dismissible={false}
      onOpenChange={() => undefined}
      open
      title={t(TRANSLATION_KEYS.accountOnboardingTitle)}
    >
      <form className="entity-editor-form" onSubmit={(event) => void submit(event)}>
        <p>{t(TRANSLATION_KEYS.accountOnboardingDescription)}</p>
        {error !== null && (
          <div className="error-message">
            <p>{t(ERROR_TRANSLATION_KEYS[error.code])}</p>
          </div>
        )}
        <label>
          {t(TRANSLATION_KEYS.fieldAccount)}
          <TextField
            aria-label={t(TRANSLATION_KEYS.fieldAccount)}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <label>
          {t(TRANSLATION_KEYS.fieldAccountOpening)}
          <TextField
            aria-label={t(TRANSLATION_KEYS.fieldAccountOpening)}
            inputMode="decimal"
            onChange={(event) => setOpeningBalanceUsd(event.target.value)}
            required
            value={openingBalanceUsd}
          />
        </label>
        <div className="ui-dialog-actions">
          <Button type="submit" variant={BUTTON_VARIANTS.primary}>
            {t(TRANSLATION_KEYS.accountOnboardingCreate)}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

const NAVIGATION = [
  { icon: Table2, id: 'trades', labelKey: TRANSLATION_KEYS.navigationTrades },
  { icon: WalletCards, id: 'catalog', labelKey: TRANSLATION_KEYS.navigationAccountsAssets },
  { icon: BarChart3, id: 'statistics', labelKey: TRANSLATION_KEYS.navigationStatistics },
  { icon: Settings, id: 'settings', labelKey: TRANSLATION_KEYS.navigationSettings },
] as const;

const isPositiveDecimal = (value: string): boolean => {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return false;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0;
};

/**
 * Prompt shown when an R trade is submitted without any 1R value: neither the
 * session field (table settings) nor the account default is set. The value is
 * saved with the trade and remembered for the account; the hint tells the user
 * where to find it later.
 */
const RiskMissingDialog = ({
  onCancel,
  onSubmit,
}: {
  readonly onCancel: () => void;
  readonly onSubmit: (value: string) => void;
}): ReactElement => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!isPositiveDecimal(value)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onSubmit(value);
  };
  return (
    <Dialog
      closeLabel={t(TRANSLATION_KEYS.actionClose)}
      onOpenChange={(open) => !open && onCancel()}
      open
      title={t(TRANSLATION_KEYS.tradeRiskMissingTitle)}
    >
      <form className="entity-editor-form" onSubmit={submit}>
        <p>{t(TRANSLATION_KEYS.tradeRiskMissingMessage)}</p>
        <label>
          {t(TRANSLATION_KEYS.tradeOneRiskUsd)}
          <TextField
            aria-label={t(TRANSLATION_KEYS.tradeOneRiskUsd)}
            inputMode="decimal"
            onChange={(event) => {
              setValue(event.target.value);
              setInvalid(false);
            }}
            placeholder={t(TRANSLATION_KEYS.tradeOneRiskUsd)}
            required
            value={value}
          />
        </label>
        {invalid && (
          <div className="error-message" role="alert">
            <p>
              {t(
                VALIDATION_TRANSLATION_KEYS['must-be-positive'] ??
                  ERROR_TRANSLATION_KEYS['validation-invalid'],
              )}
            </p>
          </div>
        )}
        <p className="form-help">{t(TRANSLATION_KEYS.tradeRiskMissingHint)}</p>
        <div className="ui-dialog-actions">
          <Button onClick={onCancel} type="button" variant={BUTTON_VARIANTS.secondary}>
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

export const JournalView = ({
  presenter,
}: {
  readonly presenter: JournalWorkspacePresenter;
}): ReactElement => {
  const journal = presenter.journal;
  const { t } = useTranslation();
  const hasActiveAccount = journal.accounts.some((account) => account.archivedAt === null);
  const themeOptions: readonly SelectOption[] = [
    { label: t(TRANSLATION_KEYS.themeAuto), value: 'auto' },
    { label: t(TRANSLATION_KEYS.themeLight), value: 'light' },
    { label: t(TRANSLATION_KEYS.themeDark), value: 'dark' },
  ];
  const languageOptions: readonly SelectOption[] = [
    { label: t(TRANSLATION_KEYS.languageSystem), value: 'system' },
    { label: t(TRANSLATION_KEYS.languageRussian), value: 'ru' },
    { label: t(TRANSLATION_KEYS.languageEnglish), value: 'en' },
  ];
  const editingTrade = presenter.editingTrade;
  const suggestedTagColor = useMemo(() => suggestTagColor(journal.tags), [journal.tags]);
  const createQuickTag = async (name: string): Promise<void> => {
    const created = await journal.createTag({ name });
    if (created !== null) presenter.setTagIds([...presenter.tagIds, created.id]);
  };
  const createDialogTag = async (name: string): Promise<void> => {
    const created = await journal.createTag({ name });
    if (created !== null && editingTrade !== null) {
      presenter.setEditingTagIds([...editingTrade.tagIds, created.id]);
    }
  };
  const tradeUnitOptions: readonly SelectOption[] = [
    { label: t(TRANSLATION_KEYS.tradeUnitCash), value: 'cash' },
    { label: t(TRANSLATION_KEYS.tradeUnitPercent), value: 'percent' },
    { label: t(TRANSLATION_KEYS.tradeUnitR), value: 'r' },
  ];
  const content =
    journal.page === 'trades' ? (
      <TradesPageView
        entryKind={presenter.entryKind}
        legacyLookupEmpty={presenter.legacyLookupEmpty}
        legacyUnassignedCount={presenter.legacyUnassignedCount}
        direction={presenter.direction}
        accounts={journal.accounts}
        instruments={presenter.instrumentSelection}
        onCreate={(event) => {
          event.preventDefault();
          void presenter.createTrade();
        }}
        onOpenDetails={presenter.openDetails}
        onOpenLegacyMigration={presenter.openLegacyMigration}
        onOpenTableLayout={() => presenter.setTableLayoutOpen(true)}
        onDirectionChange={presenter.setDirection}
        onAccountChange={presenter.setAccountId}
        onEditTrade={(tradeId) => void presenter.openSavedTrade(tradeId)}
        onResultKindChange={presenter.setResultKind}
        onResultValueChange={presenter.setResultValue}
        onEntryKindChange={presenter.setEntryKind}
        onMovementAmountChange={presenter.setMovementAmount}
        onCashMovementUpdate={async (input) => (await journal.updateCashMovement(input)) !== null}
        onSelectedDelete={() => {
          presenter.setDeletingTradeIds(presenter.tradeTable.selectedTradeIds);
          presenter.setDeletingCashMovementIds(presenter.tradeTable.selectedCashMovementIds);
        }}
        onSymbolChange={presenter.setSymbol}
        createAssetLabel={(value) => t(TRANSLATION_KEYS.assetCreateOption, { name: value })}
        createTagLabel={(name) => t(TRANSLATION_KEYS.tagCreateOption, { name })}
        onCreateTag={createQuickTag}
        onTagIdsChange={presenter.setTagIds}
        resultKind={presenter.resultKind}
        resultPreviewUsd={presenter.resultPreviewUsd}
        resultValue={presenter.resultValue}
        percentBaseUsd={presenter.percentBaseUsd}
        movementAmount={presenter.movementAmount}
        symbol={presenter.symbol}
        tagIds={presenter.tagIds}
        tags={journal.tags}
        accountId={presenter.accountId}
        summaryPresenter={presenter.tradeSummary}
        tablePresenter={presenter.tradeTable}
      />
    ) : journal.page === 'catalog' ? (
      <CatalogPageView
        accounts={journal.accounts}
        assets={journal.instruments}
        presenter={presenter.catalog}
        tags={presenter.catalog.tagRows}
      />
    ) : journal.page === 'statistics' ? (
      <StatisticsPageView
        accounts={journal.accounts}
        instruments={journal.instruments}
        presenter={presenter.statistics}
      />
    ) : (
      <section className="settings-page">
        <PageHeader title={t(TRANSLATION_KEYS.navigationSettings)} />
        <section className="settings-card">
          <h2>
            <Palette aria-hidden="true" size={16} />
            {t(TRANSLATION_KEYS.settingsInterface)}
          </h2>
          <div className="settings-fields-row">
            <label>
              {t(TRANSLATION_KEYS.fieldTheme)}
              <Select
                ariaLabel={t(TRANSLATION_KEYS.fieldTheme)}
                onValueChange={(value) =>
                  void journal.updateSettings({
                    ...journal.settings,
                    themeMode: value as 'auto' | 'dark' | 'light',
                  })
                }
                value={journal.settings.themeMode}
                options={themeOptions}
                placeholder={t(TRANSLATION_KEYS.fieldTheme)}
              />
            </label>
            <label>
              {t(TRANSLATION_KEYS.fieldLanguage)}
              <Select
                ariaLabel={t(TRANSLATION_KEYS.fieldLanguage)}
                onValueChange={(value) =>
                  void journal.updateSettings({
                    ...journal.settings,
                    languageMode: value as 'system' | 'ru' | 'en',
                  })
                }
                value={journal.settings.languageMode}
                options={languageOptions}
                placeholder={t(TRANSLATION_KEYS.fieldLanguage)}
              />
            </label>
          </div>
        </section>
        <VaultSettingsView presenter={presenter.vaultSettings} />
      </section>
    );
  return (
    <main className="desktop-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-brand">
            <span className="sidebar-brand-full">{t(TRANSLATION_KEYS.appTitle)}</span>
            <span className="sidebar-brand-compact">{t(TRANSLATION_KEYS.appTitleCompact)}</span>
          </span>
          <div className="history-actions">
            <Tooltip content={`${t(TRANSLATION_KEYS.actionUndo)} (Ctrl+Z)`}>
              <IconButton
                disabled={!journal.history.canUndo}
                label={t(TRANSLATION_KEYS.actionUndo)}
                onClick={() => void journal.undo()}
              >
                <Undo2 aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip content={`${t(TRANSLATION_KEYS.actionRedo)} (Ctrl+Y)`}>
              <IconButton
                disabled={!journal.history.canRedo}
                label={t(TRANSLATION_KEYS.actionRedo)}
                onClick={() => void journal.redo()}
              >
                <Redo2 aria-hidden="true" />
              </IconButton>
            </Tooltip>
          </div>
        </div>
        {NAVIGATION.map((item) => (
          <Button
            aria-current={journal.page === item.id ? 'page' : undefined}
            /* The compact sidebar hides the label span, so the name and tooltip
               must stay on the control itself. */
            aria-label={t(item.labelKey)}
            className={journal.page === item.id ? 'navigation-item active' : 'navigation-item'}
            key={item.id}
            onClick={() => journal.setPage(item.id)}
            title={t(item.labelKey)}
            type="button"
            variant={BUTTON_VARIANTS.ghost}
          >
            <item.icon />
            <span>{t(item.labelKey)}</span>
          </Button>
        ))}
      </aside>
      <div className="page-content">
        {journal.error !== null && (
          <div className="error-message">
            <p>{t(ERROR_TRANSLATION_KEYS[journal.error.code])}</p>
            {journal.error.issues?.map((issue, index) => (
              <p key={`${issue.path}-${index}`}>
                {issue.path}:{' '}
                {t(
                  VALIDATION_TRANSLATION_KEYS[issue.code] ??
                    ERROR_TRANSLATION_KEYS['validation-invalid'],
                )}
              </p>
            ))}
          </div>
        )}
        {content}
      </div>
      {presenter.confirmSymbol !== null && (
        <AssetCreateDialogView
          category={presenter.confirmAssetCategory}
          onCancel={presenter.closeConfirmation}
          onCategoryChange={presenter.setConfirmAssetCategory}
          onConfirm={() => void presenter.confirmAssetAndCreateTrade()}
          symbol={presenter.confirmSymbol}
        />
      )}
      {presenter.deletingTradeIds.length + presenter.deletingCashMovementIds.length > 0 && (
        <ConfirmDialog
          cancelLabel={t(TRANSLATION_KEYS.actionCancel)}
          closeLabel={t(TRANSLATION_KEYS.actionClose)}
          confirmLabel={t(TRANSLATION_KEYS.actionDelete)}
          message={t(TRANSLATION_KEYS.tableDeleteEntriesConfirmation, {
            count: presenter.deletingTradeIds.length + presenter.deletingCashMovementIds.length,
          })}
          onCancel={() => {
            presenter.setDeletingTradeIds([]);
            presenter.setDeletingCashMovementIds([]);
          }}
          onConfirm={() => void presenter.confirmDeleteEntries()}
          title={t(TRANSLATION_KEYS.tableDeleteEntriesTitle)}
        />
      )}
      {presenter.tableLayoutOpen && (
        <TableLayoutDialogView
          applyLabel={t(TRANSLATION_KEYS.actionApply)}
          cancelLabel={t(TRANSLATION_KEYS.actionCancel)}
          closeLabel={t(TRANSLATION_KEYS.actionClose)}
          columns={presenter.tableLayoutColumns}
          onApply={presenter.applyTableLayout}
          onClose={() => presenter.setTableLayoutOpen(false)}
          onToggleColumn={presenter.toggleTableLayoutColumn}
          onShowCashMovementsChange={presenter.setTableLayoutShowCashMovements}
          showCashMovements={presenter.tableLayoutShowCashMovements}
          showCashMovementsLabel={t(TRANSLATION_KEYS.tableShowCashMovements)}
          onRiskUsdChange={presenter.setTableLayoutRiskUsd}
          riskUsd={presenter.tableLayoutRiskUsd}
          riskUsdLabel={t(TRANSLATION_KEYS.tradeOneRiskUsd)}
          riskUsdHint={t(TRANSLATION_KEYS.tradeOneRiskHelp)}
          title={t(TRANSLATION_KEYS.tableLayout)}
        />
      )}
      {journal.page === 'trades' && presenter.tradeSummary.settingsOpen && (
        <TradeSummarySettingsDialogView
          settingsPresenter={presenter.tradeSettings}
          summaryPresenter={presenter.tradeSummary}
        />
      )}
      <AccountAssetEditorDialogs
        assets={presenter.instrumentSelection}
        presenter={presenter.catalog}
      />
      <TagEditorDialogView
        onClose={presenter.catalog.closeTagEditor}
        onSave={presenter.catalog.saveTag}
        open={presenter.catalog.tagEditorOpen}
        suggestedColor={suggestedTagColor}
        tag={presenter.catalog.editingTag}
      />
      {editingTrade !== null && (
        <TradeDetailsDialogView
          accounts={journal.accounts}
          accountId={editingTrade.account?.accountId ?? null}
          instruments={presenter.instrumentSelection}
          labels={{
            account: t(TRANSLATION_KEYS.fieldAccount),
            accountUnassigned: t(TRANSLATION_KEYS.accountUnassigned),
            archived: t(TRANSLATION_KEYS.statusArchived),
            apply: t(TRANSLATION_KEYS.actionSave),
            asset: t(TRANSLATION_KEYS.fieldAsset),
            cancel: t(TRANSLATION_KEYS.actionCancel),
            close: t(TRANSLATION_KEYS.actionClose),
            clear: t(TRANSLATION_KEYS.actionReset),
            commission: t(TRANSLATION_KEYS.fieldCommission),
            date: t(TRANSLATION_KEYS.fieldDate),
            direction: t(TRANSLATION_KEYS.fieldDirection),
            directionLong: t(TRANSLATION_KEYS.tradeDirectionLong),
            directionShort: t(TRANSLATION_KEYS.tradeDirectionShort),
            entryNote: t(TRANSLATION_KEYS.tradeEntryNote),
            entryPrice: t(TRANSLATION_KEYS.fieldEntryPrice),
            exitPrice: t(TRANSLATION_KEYS.fieldExitPrice),
            execution: t(TRANSLATION_KEYS.tradeExecutionSection),
            exits: t(TRANSLATION_KEYS.tradeExitsSection),
            exitAllocationKind: t(TRANSLATION_KEYS.tradeExitAllocationKind),
            addExit: t(TRANSLATION_KEYS.tradeAddExit),
            removeExit: t(TRANSLATION_KEYS.tradeRemoveExit),
            reviewNote: t(TRANSLATION_KEYS.tradeReviewNote),
            reviewStatus: t(TRANSLATION_KEYS.tradeReviewStatus),
            reviewUnreviewed: t(TRANSLATION_KEYS.tradeReviewUnreviewed),
            reviewReviewed: t(TRANSLATION_KEYS.tradeReviewReviewed),
            notesHint: t(TRANSLATION_KEYS.tradeNotesHint, {
              limit: MAX_TRADE_NOTE_CODE_POINTS,
            }),
            quantityLots: t(TRANSLATION_KEYS.fieldQuantityLots),
            exitVolume: t(TRANSLATION_KEYS.fieldExitVolume),
            exitResult: t(TRANSLATION_KEYS.fieldExitResult),
            exitResultShort: t(TRANSLATION_KEYS.fieldExitResultShort),
            spreadTicks: t(TRANSLATION_KEYS.fieldSpreadTicks),
            calculationAvailable: t(TRANSLATION_KEYS.tradeCalculationAvailable),
            calculationUnavailable: t(TRANSLATION_KEYS.tradeCalculationUnavailable),
            partialClosures: t(TRANSLATION_KEYS.fieldPartialClosures),
            result: t(TRANSLATION_KEYS.fieldResult),
            risk: t(TRANSLATION_KEYS.fieldRisk),
            stopLoss: t(TRANSLATION_KEYS.fieldStopLoss),
            time: t(TRANSLATION_KEYS.fieldTime),
            title: t(TRANSLATION_KEYS.tradeDetails),
            unit: t(TRANSLATION_KEYS.fieldUnit),
            unitCash: t(TRANSLATION_KEYS.tradeUnitCash),
            unitPercent: t(TRANSLATION_KEYS.tradeUnitPercent),
            allocationPercent: t(TRANSLATION_KEYS.tradeAllocationPercent),
            allocationLots: t(TRANSLATION_KEYS.tradeAllocationLots),
            tags: t(TRANSLATION_KEYS.fieldTag),
            tagsEmpty: t(TRANSLATION_KEYS.tagEmpty),
            tagsPlaceholder: t(TRANSLATION_KEYS.tagPickerPlaceholder),
            tagsSearch: t(TRANSLATION_KEYS.tableFilterSearch),
          }}
          onClose={presenter.closeEditor}
          onAccountChange={presenter.setEditingAccountId}
          execution={presenter.executionDraft}
          executionPreview={presenter.executionPreview}
          onDirectionChange={presenter.setEditingDirection}
          onEntryNoteChange={presenter.setEditingEntryNote}
          onExecutionEnabledChange={presenter.setExecutionEnabled}
          onExecutionFieldChange={presenter.setExecutionField}
          onExitFieldChange={presenter.setExitField}
          onExitAllocationKindChange={presenter.setExitAllocationKind}
          onExitReportedResultChange={presenter.setExitReportedResult}
          onAddExit={presenter.addExit}
          onRemoveExit={presenter.removeExit}
          onInstrumentChange={presenter.setEditingInstrumentId}
          onResultKindChange={presenter.setEditingResultKind}
          onResultValueChange={presenter.setEditingResultValue}
          onReviewNoteChange={presenter.setEditingReviewNote}
          onReviewStatusChange={presenter.setEditingReviewStatus}
          onSubmit={() => void presenter.submitEditingTrade()}
          createTagLabel={(name) => t(TRANSLATION_KEYS.tagCreateOption, { name })}
          onCreateTag={createDialogTag}
          onTagIdsChange={presenter.setEditingTagIds}
          onTimestampChange={presenter.setEditingClosedAt}
          removeTagLabel={(name) => t(TRANSLATION_KEYS.tagRemoveTag, { name })}
          tagIds={editingTrade.tagIds}
          tags={journal.tags}
          tagsAddPlaceholder={t(TRANSLATION_KEYS.tagAddPlaceholder)}
          trade={editingTrade}
          unitOptions={tradeUnitOptions}
        />
      )}
      {presenter.riskPromptOpen && (
        <RiskMissingDialog
          onCancel={presenter.cancelRiskPrompt}
          onSubmit={(value) => void presenter.submitRiskPrompt(value)}
        />
      )}
      {!hasActiveAccount && journal.accountsLoaded && (
        <AccountOnboardingDialog
          error={journal.error}
          onCreate={async ({ name, openingBalanceUsd }) => {
            await journal.createAccount({ defaults: [], name, openingBalanceUsd });
          }}
        />
      )}
    </main>
  );
};
