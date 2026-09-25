import { useMemo, useState, type ReactElement, type ReactNode } from 'react';

import { Checkbox } from './checkbox';
import { Popover } from './popover';
import { TextField } from './text-field';

export interface MultiSelectOption {
  readonly id: string;
  readonly label: string;
}

interface MultiSelectProps {
  readonly emptyMessage: string;
  readonly onSelectedIdsChange: (ids: readonly string[]) => void;
  readonly placeholder: string;
  readonly searchLabel: string;
  readonly selectedIds: readonly string[];
  readonly summary?: string;
}

interface CheckboxListProps {
  readonly onSelectedIdsChange: (ids: readonly string[]) => void;
  readonly options: readonly MultiSelectOption[];
  readonly searchLabel: string;
  readonly selectedIds: readonly string[];
}

const toSearchKey = (value: string): string => value.trim().toLocaleUpperCase();

/**
 * Searchable multi-select used by asset and account filters. Search matches the
 * localized label case-insensitively; the feature owns which entities are
 * listed. Clearing a column is a header action, so the panel never repeats it.
 */
export const MultiSelectPanel = ({
  emptyMessage,
  onSelectedIdsChange,
  options,
  placeholder,
  searchLabel,
  selectedIds,
}: MultiSelectProps & { readonly options: readonly MultiSelectOption[] }): ReactElement => {
  const [query, setQuery] = useState('');
  const selected = new Set(selectedIds);
  const visibleOptions = useMemo(() => {
    const key = toSearchKey(query);
    return key === ''
      ? options
      : options.filter((option) => option.label.toLocaleUpperCase().includes(key));
  }, [options, query]);

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
    </div>
  );
};

/**
 * Short fixed-option list rendered without a search field, for filters such as
 * entry type or result unit. An optional footer keeps related controls (for
 * example "unassigned") inside the same panel.
 */
export const CheckboxListPanel = ({
  footer,
  onSelectedIdsChange,
  options,
  searchLabel,
  selectedIds,
}: CheckboxListProps & { readonly footer?: ReactNode }): ReactElement => {
  const selected = new Set(selectedIds);
  const toggleOption = (id: string): void => {
    const next = selected.has(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id];
    onSelectedIdsChange(next);
  };
  return (
    <div className="ui-checkbox-list">
      <div className="ui-option-list" role="listbox" aria-label={searchLabel}>
        {options.map((option) => (
          <label className="ui-multi-select-option" key={option.id}>
            <Checkbox
              ariaLabel={option.label}
              checked={selected.has(option.id)}
              onCheckedChange={() => toggleOption(option.id)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {footer}
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
