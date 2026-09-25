import type { ReactElement } from 'react';

export interface TabListItem {
  readonly id: string;
  readonly label: string;
}

interface TabListProps {
  readonly activeId: string;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly onSelect: (id: string) => void;
  readonly tabs: readonly TabListItem[];
}

/**
 * One visual role for every in-page view switch. Presentational only: the
 * consumer owns the active id and the switch behaviour.
 */
export const TabList = ({
  activeId,
  ariaLabel,
  className,
  onSelect,
  tabs,
}: TabListProps): ReactElement => (
  <div
    aria-label={ariaLabel}
    className={['ui-tab-list', className].filter(Boolean).join(' ')}
    role="group"
  >
    {tabs.map((tab) => (
      <button
        aria-pressed={tab.id === activeId}
        className="ui-tab"
        key={tab.id}
        onClick={() => onSelect(tab.id)}
        type="button"
      >
        {tab.label}
      </button>
    ))}
  </div>
);
