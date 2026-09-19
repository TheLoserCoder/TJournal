import { useEffect, useState } from 'react';

import type { InstrumentDto, TradeResultKind } from '../../../shared/desktop-api';
import type { JournalPresenter } from './use-journal-presenter';

type RangeDraft = Readonly<
  Record<TradeResultKind, { readonly lower: string; readonly upper: string }>
>;
const EMPTY_RANGES: RangeDraft = {
  cash: { lower: '', upper: '' },
  percent: { lower: '', upper: '' },
  r: { lower: '', upper: '' },
};

export interface TradeSettingsPresenter {
  readonly includeCommission: boolean;
  readonly includeSpread: boolean;
  readonly instruments: readonly InstrumentDto[];
  readonly profileInstrumentId: string;
  readonly ranges: RangeDraft;
  readonly rebindHistorical: boolean;
  readonly riskKind: 'cash' | 'percent';
  readonly riskValue: string;
  readonly tickSize: string;
  readonly tickValueUsdPerLot: string;
  resetDraft(): void;
  saveProfile(): Promise<void>;
  saveRiskAndRanges(): Promise<void>;
  setProfileInstrumentId(value: string): void;
  setIncludeCommission(value: boolean): void;
  setIncludeSpread(value: boolean): void;
  setRange(kind: TradeResultKind, bound: 'lower' | 'upper', value: string): void;
  setRebindHistorical(value: boolean): void;
  setRiskKind(value: 'cash' | 'percent'): void;
  setRiskValue(value: string): void;
  setTickSize(value: string): void;
  setTickValueUsdPerLot(value: string): void;
}

export const useTradeSettingsPresenter = (journal: JournalPresenter): TradeSettingsPresenter => {
  const getInstrumentProfile = journal.getInstrumentProfile;
  const binding = journal.tradePreferences.riskBinding;
  const [riskKind, setRiskKind] = useState<'cash' | 'percent'>(binding?.kind ?? 'cash');
  const [riskValue, setRiskValue] = useState(binding?.value ?? '');
  const [rebindHistorical, setRebindHistorical] = useState(false);
  const [includeCommission, setIncludeCommission] = useState(
    journal.tradePreferences.neutralCostSettings.includeCommission,
  );
  const [includeSpread, setIncludeSpread] = useState(
    journal.tradePreferences.neutralCostSettings.includeSpread,
  );
  const [ranges, setRanges] = useState<RangeDraft>(EMPTY_RANGES);
  const [profileInstrumentId, setProfileInstrumentId] = useState(journal.instruments[0]?.id ?? '');
  const [tickSize, setTickSize] = useState('');
  const [tickValueUsdPerLot, setTickValueUsdPerLot] = useState('');

  useEffect(() => {
    setRiskKind(binding?.kind ?? 'cash');
    setRiskValue(binding?.value ?? '');
    setIncludeCommission(journal.tradePreferences.neutralCostSettings.includeCommission);
    setIncludeSpread(journal.tradePreferences.neutralCostSettings.includeSpread);
    setRanges(
      Object.fromEntries(
        Object.entries(journal.tradePreferences.neutralRanges).map(([kind, range]) => [
          kind,
          range ?? { lower: '', upper: '' },
        ]),
      ) as RangeDraft,
    );
  }, [
    binding,
    journal.tradePreferences.neutralCostSettings,
    journal.tradePreferences.neutralRanges,
  ]);

  const resetDraft = (): void => {
    const currentBinding = journal.tradePreferences.riskBinding;
    setRiskKind(currentBinding?.kind ?? 'cash');
    setRiskValue(currentBinding?.value ?? '');
    setIncludeCommission(journal.tradePreferences.neutralCostSettings.includeCommission);
    setIncludeSpread(journal.tradePreferences.neutralCostSettings.includeSpread);
    setRanges(
      Object.fromEntries(
        Object.entries(journal.tradePreferences.neutralRanges).map(([kind, range]) => [
          kind,
          range ?? { lower: '', upper: '' },
        ]),
      ) as RangeDraft,
    );
    setRebindHistorical(false);
  };

  useEffect(() => {
    if (profileInstrumentId === '') return;
    void getInstrumentProfile(profileInstrumentId).then((profile) => {
      setTickSize(profile?.tickSize ?? '');
      setTickValueUsdPerLot(profile?.tickValueUsdPerLot ?? '');
    });
  }, [getInstrumentProfile, profileInstrumentId]);

  return {
    includeCommission,
    includeSpread,
    instruments: journal.instruments,
    profileInstrumentId,
    ranges,
    rebindHistorical,
    resetDraft,
    riskKind,
    riskValue,
    saveProfile: async () => {
      await journal.updateInstrumentProfile({
        instrumentId: profileInstrumentId,
        tickSize,
        tickValueUsdPerLot,
        updatedAt: new Date().toISOString(),
      });
    },
    saveRiskAndRanges: async () => {
      const neutralRanges = Object.fromEntries(
        Object.entries(ranges).map(([kind, range]) => [
          kind,
          range.lower === '' && range.upper === '' ? null : range,
        ]),
      ) as typeof journal.tradePreferences.neutralRanges;
      await journal.updateTradePreferences(
        {
          ...journal.tradePreferences,
          neutralCostSettings: { includeCommission, includeSpread },
          neutralRanges,
          riskBinding: riskValue === '' ? null : { kind: riskKind, value: riskValue },
        },
        rebindHistorical,
      );
      setRebindHistorical(false);
    },
    setProfileInstrumentId,
    setIncludeCommission,
    setIncludeSpread,
    setRange: (kind, bound, value) =>
      setRanges((current) => ({ ...current, [kind]: { ...current[kind], [bound]: value } })),
    setRebindHistorical,
    setRiskKind,
    setRiskValue,
    setTickSize,
    setTickValueUsdPerLot,
    tickSize,
    tickValueUsdPerLot,
  };
};
