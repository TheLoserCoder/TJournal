import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { ReactElement } from 'react';

interface DirectionToggleProps {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly longLabel: string;
  readonly onChange: (value: 'long' | 'short') => void;
  readonly shortLabel: string;
  readonly value: 'long' | 'short';
}

/** Compact two-state direction control shared by quick entry and trade details. */
export const DirectionToggle = ({
  ariaLabel,
  className,
  longLabel,
  onChange,
  shortLabel,
  value,
}: DirectionToggleProps): ReactElement => (
  <div
    aria-label={ariaLabel}
    className={['ui-direction-toggle', className].filter(Boolean).join(' ')}
    role="group"
  >
    <button
      aria-label={longLabel}
      aria-pressed={value === 'long'}
      className="ui-direction-toggle-option entry-type-entry entry-type-long"
      data-active={value === 'long' ? 'true' : 'false'}
      data-entry-type="long"
      onClick={() => onChange('long')}
      title={longLabel}
      type="button"
    >
      <ArrowUpRight aria-hidden="true" />
      <span aria-hidden="true">L</span>
    </button>
    <button
      aria-label={shortLabel}
      aria-pressed={value === 'short'}
      className="ui-direction-toggle-option entry-type-entry entry-type-short"
      data-active={value === 'short' ? 'true' : 'false'}
      data-entry-type="short"
      onClick={() => onChange('short')}
      title={shortLabel}
      type="button"
    >
      <ArrowDownRight aria-hidden="true" />
      <span aria-hidden="true">S</span>
    </button>
  </div>
);
