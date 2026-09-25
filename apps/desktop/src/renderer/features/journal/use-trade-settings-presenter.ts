import { useEffect, useState } from 'react';

import type { TradeResultKind } from '../../../shared/desktop-api';
import type { JournalPresenter } from './use-journal-presenter';

type RangeDraft = Readonly<
  Record<TradeResultKind, { readonly lower: string; readonly upper: string }>
>;
const EMPTY_RANGES: RangeDraft = {
  cash: { lower: '', upper: '' },
  percent: { lower: '', upper: '' },
  r: { lower: '', upper: '' },
};

/**
 * Neutral-range and cost settings used by the quick trade summary dialog.
 * Risk and instrument-calculation profiles are edited where the entity lives:
 * the account editor owns 1R, the asset editor owns tick size and tick value.
 */
export interface TradeSettingsPresenter {
  readonly includeCommission: boolean;
  readonly includeSpread: boolean;
  readonly ranges: RangeDraft;
  resetDraft(): void;
  saveNeutralSettings(): Promise<void>;
  setIncludeCommission(value: boolean): void;
  setIncludeSpread(value: boolean): void;
  setRange(kind: TradeResultKind, bound: 'lower' | 'upper', value: string): void;
}

export const useTradeSettingsPresenter = (journal: JournalPresenter): TradeSettingsPresenter => {
  const [includeCommission, setIncludeCommission] = useState(
    journal.tradePreferences.neutralCostSettings.includeCommission,
  );
  const [includeSpread, setIncludeSpread] = useState(
    journal.tradePreferences.neutralCostSettings.includeSpread,
  );
  const [ranges, setRanges] = useState<RangeDraft>(EMPTY_RANGES);

  const toDraftRanges = (): RangeDraft =>
    Object.fromEntries(
      Object.entries(journal.tradePreferences.neutralRanges).map(([kind, range]) => [
        kind,
        range ?? { lower: '', upper: '' },
      ]),
    ) as RangeDraft;

  useEffect(() => {
    setIncludeCommission(journal.tradePreferences.neutralCostSettings.includeCommission);
    setIncludeSpread(journal.tradePreferences.neutralCostSettings.includeSpread);
    setRanges(toDraftRanges());
    // The presenter is a render-scoped facade; preference identity is the sync key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journal.tradePreferences.neutralCostSettings, journal.tradePreferences.neutralRanges]);

  const resetDraft = (): void => {
    setIncludeCommission(journal.tradePreferences.neutralCostSettings.includeCommission);
    setIncludeSpread(journal.tradePreferences.neutralCostSettings.includeSpread);
    setRanges(toDraftRanges());
  };

  return {
    includeCommission,
    includeSpread,
    ranges,
    resetDraft,
    saveNeutralSettings: async () => {
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
        },
        false,
      );
    },
    setIncludeCommission,
    setIncludeSpread,
    setRange: (kind, bound, value) =>
      setRanges((current) => ({ ...current, [kind]: { ...current[kind], [bound]: value } })),
  };
};
