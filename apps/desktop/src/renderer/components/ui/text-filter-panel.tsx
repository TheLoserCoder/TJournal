import type { ReactElement } from 'react';

import { TextField } from './text-field';

export interface TextFilterState {
  readonly value: string;
}

interface TextFilterPanelProps {
  readonly label: string;
  readonly onChange: (state: TextFilterState) => void;
  readonly state: TextFilterState;
}

/**
 * Shared free-text filter. Matching semantics belong to the feature predicate;
 * the panel only edits a search string. Resetting a column is a header action,
 * so the panel never repeats it.
 */
export const TextFilterPanel = ({ label, onChange, state }: TextFilterPanelProps): ReactElement => (
  <div className="ui-filter-panel">
    <TextField
      aria-label={label}
      onChange={(event) => onChange({ value: event.target.value })}
      placeholder={label}
      value={state.value}
    />
  </div>
);
