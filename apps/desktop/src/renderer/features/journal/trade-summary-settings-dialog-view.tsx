import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/ui/button';
import { BUTTON_VARIANTS } from '../../components/ui/button.config';
import { Checkbox } from '../../components/ui/checkbox';
import { Dialog } from '../../components/ui/dialog';
import { Select } from '../../components/ui/select';
import { TextField } from '../../components/ui/text-field';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import type { TradeSettingsPresenter } from './use-trade-settings-presenter';
import type { TradeSummaryPresenter } from './use-trade-summary-presenter';

interface TradeSummarySettingsDialogViewProps {
  readonly settingsPresenter: TradeSettingsPresenter;
  readonly summaryPresenter: TradeSummaryPresenter;
}

export const TradeSummarySettingsDialogView = ({
  settingsPresenter,
  summaryPresenter,
}: TradeSummarySettingsDialogViewProps): ReactElement => {
  const { t } = useTranslation();
  const closeWithoutSaving = (): void => {
    settingsPresenter.resetDraft();
    summaryPresenter.closeSettings();
  };
  const metrics = [
    ['cash', t(TRANSLATION_KEYS.tradeUnitCash)],
    ['percent', t(TRANSLATION_KEYS.tradeUnitPercent)],
    ['r', t(TRANSLATION_KEYS.tradeUnitR)],
  ] as const;

  return (
    <Dialog
      closeLabel={t(TRANSLATION_KEYS.actionClose)}
      onOpenChange={(open) => !open && closeWithoutSaving()}
      open
      title={t(TRANSLATION_KEYS.statisticsSettings)}
    >
      <div className="trade-summary-settings-form">
        <div className="trade-summary-settings-grid">
          <label>
            {t(TRANSLATION_KEYS.statisticsMetric)}
            <Select
              ariaLabel={t(TRANSLATION_KEYS.statisticsMetric)}
              layer="dialog"
              onValueChange={(value) =>
                summaryPresenter.setMetric(value as typeof summaryPresenter.metric)
              }
              options={metrics.map(([value, label]) => ({ label, value }))}
              placeholder={t(TRANSLATION_KEYS.statisticsMetric)}
              value={summaryPresenter.metric}
            />
          </label>
          <label>
            {t(TRANSLATION_KEYS.statisticsPeriod)}
            <Select
              ariaLabel={t(TRANSLATION_KEYS.statisticsPeriod)}
              layer="dialog"
              onValueChange={(value) =>
                summaryPresenter.setPeriod(value as typeof summaryPresenter.period)
              }
              options={[
                { label: t(TRANSLATION_KEYS.statisticsPeriodAll), value: 'all' },
                { label: t(TRANSLATION_KEYS.statisticsPeriodYear), value: 'current-year' },
                { label: t(TRANSLATION_KEYS.statisticsPeriodQuarter), value: 'current-quarter' },
                { label: t(TRANSLATION_KEYS.statisticsPeriodMonth), value: 'current-month' },
                { label: t(TRANSLATION_KEYS.statisticsPeriodWeek), value: 'current-week' },
                { label: t(TRANSLATION_KEYS.statisticsPeriodDay), value: 'current-day' },
              ]}
              placeholder={t(TRANSLATION_KEYS.statisticsPeriod)}
              value={summaryPresenter.period}
            />
          </label>
        </div>
        <label className="trade-summary-filter-toggle">
          <Checkbox
            ariaLabel={t(TRANSLATION_KEYS.statisticsIncludeFilters)}
            checked={summaryPresenter.followTableFilters}
            onCheckedChange={summaryPresenter.setFollowTableFilters}
          />
          {t(TRANSLATION_KEYS.statisticsIncludeFilters)}
        </label>
        <fieldset className="neutral-ranges">
          <legend>{t(TRANSLATION_KEYS.settingsNeutralRanges)}</legend>
          <p className="settings-help">{t(TRANSLATION_KEYS.settingsNeutralRangesHint)}</p>
          {metrics.map(([kind, label]) => (
            <div className="neutral-range" key={kind}>
              <strong>{label}</strong>
              <label>
                {t(TRANSLATION_KEYS.settingsNeutralLower)}
                <TextField
                  inputMode="decimal"
                  value={settingsPresenter.ranges[kind].lower}
                  onChange={(event) =>
                    settingsPresenter.setRange(kind, 'lower', event.target.value)
                  }
                />
              </label>
              <label>
                {t(TRANSLATION_KEYS.settingsNeutralUpper)}
                <TextField
                  inputMode="decimal"
                  value={settingsPresenter.ranges[kind].upper}
                  onChange={(event) =>
                    settingsPresenter.setRange(kind, 'upper', event.target.value)
                  }
                />
              </label>
            </div>
          ))}
        </fieldset>
        <fieldset className="statistics-cost-settings">
          <legend>{t(TRANSLATION_KEYS.settingsNeutralCosts)}</legend>
          <p className="settings-help">{t(TRANSLATION_KEYS.settingsNeutralCostsHint)}</p>
          <label className="trade-summary-filter-toggle">
            <Checkbox
              ariaLabel={t(TRANSLATION_KEYS.settingsIncludeCommission)}
              checked={settingsPresenter.includeCommission}
              onCheckedChange={settingsPresenter.setIncludeCommission}
            />
            {t(TRANSLATION_KEYS.settingsIncludeCommission)}
          </label>
          <label className="trade-summary-filter-toggle">
            <Checkbox
              ariaLabel={t(TRANSLATION_KEYS.settingsIncludeSpread)}
              checked={settingsPresenter.includeSpread}
              onCheckedChange={settingsPresenter.setIncludeSpread}
            />
            {t(TRANSLATION_KEYS.settingsIncludeSpread)}
          </label>
        </fieldset>
      </div>
      <div className="ui-dialog-actions">
        <Button onClick={closeWithoutSaving} type="button" variant={BUTTON_VARIANTS.secondary}>
          {t(TRANSLATION_KEYS.actionCancel)}
        </Button>
        <Button
          onClick={() => {
            void settingsPresenter.saveNeutralSettings().then(summaryPresenter.closeSettings);
          }}
          type="button"
        >
          {t(TRANSLATION_KEYS.actionSave)}
        </Button>
      </div>
    </Dialog>
  );
};
