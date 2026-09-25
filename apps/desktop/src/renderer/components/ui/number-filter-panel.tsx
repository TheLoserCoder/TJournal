import { useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { TRANSLATION_KEYS } from '../../i18n-keys';
import {
  NUMBER_FILTER_MODES,
  type NumberFilterMode,
  type NumberFilterState,
} from './number-filter-state';
import { Select, type SelectOption } from './select';
import { TextField } from './text-field';

interface NumberFilterPanelProps {
  readonly label: string;
  readonly onChange: (state: NumberFilterState) => void;
  readonly state: NumberFilterState;
  /** Present on currency columns; placeholders then carry the `$` suffix. */
  readonly unit?: string;
}

/**
 * Bound editor for numeric columns. Decimal comparison and boundary semantics
 * live in the feature presenter; this panel only edits the requested bounds and
 * reports an inverted range locally so an incomplete rule is never applied.
 *
 * Modes are locale-independent symbols so the selector stays narrow; the mode
 * selector and the active bound share one row. Currency is shown as a `$`
 * suffix inside the placeholder instead of a separate label. Resetting a column
 * is a header action, so the panel never repeats it.
 */
export const NumberFilterPanel = ({
  label,
  onChange,
  state,
  unit,
}: NumberFilterPanelProps): ReactElement => {
  const { t } = useTranslation();
  const [invalid, setInvalid] = useState(false);
  const options: readonly SelectOption[] = useMemo(
    () => [
      { label: '>', value: NUMBER_FILTER_MODES.greaterThan },
      { label: '<', value: NUMBER_FILTER_MODES.lessThan },
      { label: '=', value: NUMBER_FILTER_MODES.equals },
      { label: '><', value: NUMBER_FILTER_MODES.between },
    ],
    [],
  );
  const report = (next: NumberFilterState): void => {
    const min = next.minimum.trim().replace(',', '.');
    const max = next.maximum.trim().replace(',', '.');
    const minValue = Number.parseFloat(min);
    const maxValue = Number.parseFloat(max);
    const invalidRange =
      next.mode === NUMBER_FILTER_MODES.between &&
      Number.isFinite(minValue) &&
      Number.isFinite(maxValue) &&
      minValue > maxValue;
    setInvalid(invalidRange);
    onChange(next);
  };
  const isCurrency = unit !== undefined;
  const minimumLabel = t(TRANSLATION_KEYS.tableFilterMinimum);
  const maximumLabel = t(TRANSLATION_KEYS.tableFilterMaximum);
  const valueLabel = t(TRANSLATION_KEYS.tableFilterValue);
  const minimumPlaceholder = isCurrency
    ? t(TRANSLATION_KEYS.tableFilterMinimumCurrency)
    : minimumLabel;
  const maximumPlaceholder = isCurrency
    ? t(TRANSLATION_KEYS.tableFilterMaximumCurrency)
    : maximumLabel;
  const valuePlaceholder = isCurrency ? t(TRANSLATION_KEYS.tableFilterValueCurrency) : valueLabel;

  const renderBounds = (): readonly ReactElement[] => {
    if (state.mode === NUMBER_FILTER_MODES.between) {
      return [
        <TextField
          aria-label={minimumLabel}
          className="ui-number-filter-value"
          inputMode="decimal"
          key="minimum"
          onChange={(event) => report({ ...state, minimum: event.target.value })}
          placeholder={minimumPlaceholder}
          value={state.minimum}
        />,
        <TextField
          aria-label={maximumLabel}
          className="ui-number-filter-value"
          inputMode="decimal"
          key="maximum"
          onChange={(event) => report({ ...state, maximum: event.target.value })}
          placeholder={maximumPlaceholder}
          value={state.maximum}
        />,
      ];
    }
    if (state.mode === NUMBER_FILTER_MODES.lessThan) {
      return [
        <TextField
          aria-label={maximumLabel}
          className="ui-number-filter-value"
          inputMode="decimal"
          key="maximum"
          onChange={(event) => report({ ...state, maximum: event.target.value })}
          placeholder={maximumPlaceholder}
          value={state.maximum}
        />,
      ];
    }
    return [
      <TextField
        aria-label={state.mode === NUMBER_FILTER_MODES.equals ? valueLabel : minimumLabel}
        className="ui-number-filter-value"
        inputMode="decimal"
        key="minimum"
        onChange={(event) => report({ ...state, minimum: event.target.value })}
        placeholder={
          state.mode === NUMBER_FILTER_MODES.equals ? valuePlaceholder : minimumPlaceholder
        }
        value={state.minimum}
      />,
    ];
  };

  return (
    <div className="ui-number-filter">
      <div className="ui-number-filter-row">
        <Select
          ariaLabel={label}
          className="ui-number-filter-mode"
          onValueChange={(value) =>
            report({ maximum: '', minimum: '', mode: value as NumberFilterMode })
          }
          options={options}
          value={state.mode}
        />
        {renderBounds()}
      </div>
      {invalid && (
        <p className="ui-filter-panel-error" role="alert">
          {t(TRANSLATION_KEYS.tableFilterRangeInvalid)}
        </p>
      )}
    </div>
  );
};
