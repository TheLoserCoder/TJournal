import { useMemo, useState, type ReactElement } from 'react';
import { RotateCcw } from 'lucide-react';

import { Checkbox } from './checkbox';
import { IconButton } from './icon-button';
import { Popover } from './popover';
import { TextField } from './text-field';
import { Tooltip } from './tooltip';

export interface MultiSelectOption {
  readonly id: string;
  readonly label: string;
}

interface MultiSelectProps {
  readonly clearLabel: string;
  readonly emptyMessage: string;
  readonly onSelectedIdsChange: (ids: readonly string[]) => void;
  readonly placeholder: string;
  readonly searchLabel: string;
  readonly selectedIds: readonly string[];
  readonly summary: string;
}

export const MultiSelectPanel = ({
  clearLabel,
  emptyMessage,
  onSelectedIdsChange,
  options,
  placeholder,
  searchLabel,
  selectedIds,
  summary,
}: MultiSelectProps & { readonly options: readonly MultiSelectOption[] }): ReactElement => {
  void summary;
  const [query, setQuery] = useState('');
  const selected = new Set(selectedIds);
  const visibleOptions = useMemo(
    () => options.filter((option) => option.label.includes(query.trim().toUpperCase())),
    [options, query],
  );

  const toggleOption = (id: string): void => {
    const next = selected.has(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id];
    onSelectedIdsChange(next);
  };

  return (
    <div className="ui-multi-select">
      <TextField
        aria-label={searchLabel}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        value={query}
      />
      <div className="ui-option-list" role="listbox">
        {visibleOptions.length === 0 ? (
          <p className="ui-empty-state">{emptyMessage}</p>
        ) : (
          visibleOptions.map((option) => (
            <label className="ui-multi-select-option" key={option.id}>
              <Checkbox
                ariaLabel={option.label}
                checked={selected.has(option.id)}
                onCheckedChange={() => toggleOption(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))
        )}
      </div>
      <div className="ui-filter-panel-actions">
        <Tooltip content={clearLabel}>
          <IconButton
            disabled={selectedIds.length === 0}
            label={clearLabel}
            onClick={() => onSelectedIdsChange([])}
          >
            <RotateCcw aria-hidden="true" />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
};

export const MultiSelect = (
  props: MultiSelectProps & { readonly options: readonly MultiSelectOption[] },
): ReactElement => {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      onOpenChange={setOpen}
      open={open}
      trigger={
        <button aria-label={props.searchLabel} className="ui-filter-trigger" type="button">
          {props.summary || props.placeholder}
        </button>
      }
    >
      <MultiSelectPanel {...props} />
    </Popover>
  );
};
