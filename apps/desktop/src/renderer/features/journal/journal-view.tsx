import type { FormEvent, ReactElement } from 'react';
import { BarChart3, Home, Redo2, Settings, Table2, Undo2, WalletCards } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import { TableLayoutDialogView } from './table-layout-dialog-view';
import { TradeDetailsDialogView } from './trade-details-dialog-view';
import { TradeSummarySettingsDialogView } from './trade-summary-settings-dialog-view';
import type { JournalWorkspacePresenter } from './use-journal-workspace-presenter';
import { TradeSettingsView } from './trade-settings-view';
import { AccountsAssetsPageView } from './accounts-assets-page-view';

const AccountOnboardingDialog = ({
  onCancel,
  onCreate,
}: {
  readonly onCancel: () => void;
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
      onOpenChange={(open) => !open && onCancel()}
      open
      title={t(TRANSLATION_KEYS.accountOnboardingTitle)}
    >
      <form className="entity-editor-form" onSubmit={(event) => void submit(event)}>
        <p>{t(TRANSLATION_KEYS.accountOnboardingDescription)}</p>
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
          <Button onClick={onCancel} type="button" variant={BUTTON_VARIANTS.secondary}>
            {t(TRANSLATION_KEYS.accountOnboardingSkip)}
          </Button>
          <Button type="submit" variant={BUTTON_VARIANTS.success}>
            {t(TRANSLATION_KEYS.accountOnboardingCreate)}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

const NAVIGATION = [
  { icon: Home, id: 'dashboard', labelKey: TRANSLATION_KEYS.navigationDashboard },
  { icon: Table2, id: 'trades', labelKey: TRANSLATION_KEYS.navigationTrades },
  { icon: WalletCards, id: 'accounts-assets', labelKey: TRANSLATION_KEYS.navigationAccountsAssets },
  { icon: BarChart3, id: 'statistics', labelKey: TRANSLATION_KEYS.navigationStatistics },
  { icon: Settings, id: 'settings', labelKey: TRANSLATION_KEYS.navigationSettings },
] as const;

export const JournalView = ({
  presenter,
}: {
  readonly presenter: JournalWorkspacePresenter;
}): ReactElement => {
  const journal = presenter.journal;
  const { t } = useTranslation();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const hasActiveAccount = journal.accounts.some((account) => account.archivedAt === null);
  useEffect(() => {
    if (hasActiveAccount) setOnboardingDismissed(false);
  }, [hasActiveAccount]);
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
  const tradeUnitOptions: readonly SelectOption[] = [
    { label: t(TRANSLATION_KEYS.tradeUnitCash), value: 'cash' },
    { label: t(TRANSLATION_KEYS.tradeUnitPercent), value: 'percent' },
    { label: t(TRANSLATION_KEYS.tradeUnitR), value: 'r' },
  ];
  const content =
    journal.page === 'trades' ? (
      <TradesPageView
        entryKind={presenter.entryKind}
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
        onResultKindChange={presenter.setResultKind}
        onResultValueChange={presenter.setResultValue}
        onRiskUsdChange={presenter.setRiskUsd}
        onEntryKindChange={presenter.setEntryKind}
        onMovementAmountChange={presenter.setMovementAmount}
        onCashMovementUpdate={async (input) => {
          await journal.updateCashMovement(input);
        }}
        onSelectedDelete={() => {
          presenter.setDeletingTradeIds(presenter.tradeTable.selectedTradeIds);
          presenter.setDeletingCashMovementIds(presenter.tradeTable.selectedCashMovementIds);
        }}
        onSelectedEdit={() => {
          const selectedTrade = presenter.tradeTable.selectedTrade;
          if (selectedTrade !== null) presenter.setEditingTrade(selectedTrade);
        }}
        onSymbolChange={presenter.setSymbol}
        resultKind={presenter.resultKind}
        resultPreviewUsd={presenter.resultPreviewUsd}
        resultValue={presenter.resultValue}
        percentBaseUsd={presenter.percentBaseUsd}
        riskUsd={presenter.riskUsd}
        movementAmount={presenter.movementAmount}
        symbol={presenter.symbol}
        accountId={presenter.accountId}
        summaryPresenter={presenter.tradeSummary}
        tablePresenter={presenter.tradeTable}
      />
    ) : journal.page === 'accounts-assets' ? (
      <AccountsAssetsPageView
        accounts={journal.accounts}
        assets={journal.instruments}
        presenter={presenter.accountsAssets}
      />
    ) : journal.page === 'settings' ? (
      <section>
        <PageHeader title={t(TRANSLATION_KEYS.navigationSettings)} />
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
        <TradeSettingsView presenter={presenter.tradeSettings} />
      </section>
    ) : (
      <section>
        <PageHeader
          title={t(
            journal.page === 'dashboard'
              ? TRANSLATION_KEYS.navigationDashboard
              : TRANSLATION_KEYS.navigationStatistics,
          )}
        />
        <p>{t(TRANSLATION_KEYS.pageComingSoon)}</p>
      </section>
    );
  return (
    <main className="desktop-shell">
      <aside className="sidebar">
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
        {NAVIGATION.map((item) => (
          <Button
            className={journal.page === item.id ? 'navigation-item active' : 'navigation-item'}
            key={item.id}
            onClick={() => journal.setPage(item.id)}
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
        <ConfirmDialog
          cancelLabel={t(TRANSLATION_KEYS.actionCancel)}
          closeLabel={t(TRANSLATION_KEYS.actionClose)}
          confirmLabel={t(TRANSLATION_KEYS.actionCreate)}
          message={t(TRANSLATION_KEYS.assetCreateConfirmation, { symbol: presenter.confirmSymbol })}
          onCancel={presenter.closeConfirmation}
          onConfirm={() => void presenter.confirmAssetAndCreateTrade()}
          title={t(TRANSLATION_KEYS.assetCreateTitle)}
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
          title={t(TRANSLATION_KEYS.tableLayout)}
        />
      )}
      {journal.page === 'trades' && presenter.tradeSummary.settingsOpen && (
        <TradeSummarySettingsDialogView
          settingsPresenter={presenter.tradeSettings}
          summaryPresenter={presenter.tradeSummary}
        />
      )}
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
            entryPrice: t(TRANSLATION_KEYS.fieldEntryPrice),
            exitPrice: t(TRANSLATION_KEYS.fieldExitPrice),
            execution: t(TRANSLATION_KEYS.tradeExecutionSection),
            exits: t(TRANSLATION_KEYS.tradeExitsSection),
            addExit: t(TRANSLATION_KEYS.tradeAddExit),
            removeExit: t(TRANSLATION_KEYS.tradeRemoveExit),
            quantityLots: t(TRANSLATION_KEYS.fieldQuantityLots),
            exitVolume: t(TRANSLATION_KEYS.fieldExitVolume),
            exitResult: t(TRANSLATION_KEYS.fieldExitResult),
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
          }}
          onClose={presenter.closeEditor}
          onAccountChange={presenter.setEditingAccountId}
          execution={presenter.executionDraft}
          executionPreview={presenter.executionPreview}
          onDirectionChange={presenter.setEditingDirection}
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
          onSubmit={() => void presenter.submitEditingTrade()}
          onTimestampChange={presenter.setEditingClosedAt}
          trade={editingTrade}
          unitOptions={tradeUnitOptions}
        />
      )}
      {presenter.riskPromptOpen && (
        <Dialog
          closeLabel={t(TRANSLATION_KEYS.actionClose)}
          onOpenChange={(open) => !open && presenter.cancelRiskPrompt()}
          open
          title={t(TRANSLATION_KEYS.tradeRiskPromptTitle)}
        >
          <p>{t(TRANSLATION_KEYS.tradeRiskPromptMessage)}</p>
          <div className="ui-dialog-actions">
            <Button
              onClick={presenter.cancelRiskPrompt}
              type="button"
              variant={BUTTON_VARIANTS.secondary}
            >
              {t(TRANSLATION_KEYS.actionCancel)}
            </Button>
            <Button
              onClick={() => void presenter.dismissRiskPrompt()}
              type="button"
              variant={BUTTON_VARIANTS.secondary}
            >
              {t(TRANSLATION_KEYS.tradeRiskPromptDismiss)}
            </Button>
            <Button onClick={presenter.openRiskSettings} type="button">
              {t(TRANSLATION_KEYS.tradeRiskPromptConfigure)}
            </Button>
          </div>
        </Dialog>
      )}
      {!hasActiveAccount && !onboardingDismissed && (
        <AccountOnboardingDialog
          onCancel={() => setOnboardingDismissed(true)}
          onCreate={async ({ name, openingBalanceUsd }) => {
            const account = await journal.createAccount({ defaults: [], name, openingBalanceUsd });
            if (account !== null) setOnboardingDismissed(false);
          }}
        />
      )}
    </main>
  );
};
