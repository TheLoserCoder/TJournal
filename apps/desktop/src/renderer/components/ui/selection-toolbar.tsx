import type { ReactElement, ReactNode } from 'react';

interface SelectionToolbarProps {
  readonly children: ReactNode;
  readonly label?: string;
}

/** Stable-height action surface shown while table rows are selected. */
export const SelectionToolbar = ({ children, label }: SelectionToolbarProps): ReactElement => (
  <div className="selection-toolbar" aria-live="polite">
    {label !== undefined && label !== '' && (
      <span className="selection-toolbar-label">{label}</span>
    )}
    <div className="selection-toolbar-actions">{children}</div>
  </div>
);
