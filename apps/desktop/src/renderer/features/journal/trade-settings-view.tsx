import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Select } from '../../components/ui/select';
import { TextField } from '../../components/ui/text-field';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import type { TradeSettingsPresenter } from './use-trade-settings-presenter';

export const TradeSettingsView = ({
  presenter,
}: {
  readonly presenter: TradeSettingsPresenter;
}): ReactElement => {
  const { t } = useTranslation();
  const metrics = [
    ['cash', t(TRANSLATION_KEYS.tradeUnitCash)],
    ['percent', t(TRANSLATION_KEYS.tradeUnitPercent)],
  ] as const;
  return (
    <div className="trade-settings-grid">
      <section className="settings-card">
        <h2>{t(TRANSLATION_KEYS.settingsRiskStatistics)}</h2>
        <div className="settings-fields-row">
          <label>
            {t(TRANSLATION_KEYS.settingsRiskBinding)}
            <Select
              ariaLabel={t(TRANSLATION_KEYS.settingsRiskBinding)}
              value={presenter.riskKind}
              onValueChange={(value) => presenter.setRiskKind(value as 'cash' | 'percent')}
              options={metrics.slice(0, 2).map(([value, label]) => ({ value, label }))}
              placeholder={t(TRANSLATION_KEYS.settingsRiskBinding)}
            />
          </label>
          <label>
            {t(TRANSLATION_KEYS.settingsRiskValue)}
            <TextField
              inputMode="decimal"
              value={presenter.riskValue}
              onChange={(event) => presenter.setRiskValue(event.target.value)}
            />
          </label>
        </div>
        <label className="settings-checkbox">
          <Checkbox
            ariaLabel={t(TRANSLATION_KEYS.settingsRebindHistorical)}
            checked={presenter.rebindHistorical}
            onCheckedChange={presenter.setRebindHistorical}
          />
          {t(TRANSLATION_KEYS.settingsRebindHistorical)}
        </label>
        <Button type="button" onClick={() => void presenter.saveRiskAndRanges()}>
          {t(TRANSLATION_KEYS.actionSave)}
        </Button>
      </section>
      <section className="settings-card">
        <h2>{t(TRANSLATION_KEYS.settingsInstrumentProfiles)}</h2>
        <label>
          {t(TRANSLATION_KEYS.settingsSelectInstrument)}
          <Select
            ariaLabel={t(TRANSLATION_KEYS.settingsSelectInstrument)}
            value={presenter.profileInstrumentId}
            onValueChange={presenter.setProfileInstrumentId}
            options={presenter.instruments.map((instrument) => ({
              label: instrument.symbol,
              value: instrument.id,
            }))}
            placeholder={t(TRANSLATION_KEYS.settingsSelectInstrument)}
          />
        </label>
        <label>
          {t(TRANSLATION_KEYS.settingsTickSize)}
          <TextField
            inputMode="decimal"
            value={presenter.tickSize}
            onChange={(event) => presenter.setTickSize(event.target.value)}
          />
        </label>
        <label>
          {t(TRANSLATION_KEYS.settingsTickValue)}
          <TextField
            inputMode="decimal"
            value={presenter.tickValueUsdPerLot}
            onChange={(event) => presenter.setTickValueUsdPerLot(event.target.value)}
          />
        </label>
        <Button type="button" onClick={() => void presenter.saveProfile()}>
          {t(TRANSLATION_KEYS.actionSave)}
        </Button>
      </section>
    </div>
  );
};
