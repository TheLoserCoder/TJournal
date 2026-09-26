import { Plus } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';

import type { TagDto } from '../../../shared/desktop-api';
import { Checkbox } from '../../components/ui/checkbox';
import { Popover } from '../../components/ui/popover';
import { TextField } from '../../components/ui/text-field';
import { TagChip } from './tag-chip';

interface TagPickerProps {
  readonly className?: string;
  /** Label of the inline "create" row, interpolated with the typed name. */
  readonly createLabel: (name: string) => string;
  readonly emptyMessage: string;
  /** Highlights the trigger while any tag is selected; the caption never changes. */
  readonly hasSelection: boolean;
  readonly label: string;
  readonly layer?: 'base' | 'dialog';
  readonly onCreateTag: (name: string) => Promise<void>;
  readonly onSelectedIdsChange: (ids: readonly string[]) => void;
  readonly options: readonly TagDto[];
  readonly placeholder: string;
  readonly searchPlaceholder: string;
  readonly selectedIds: readonly string[];
}

/**
 * Searchable multi-select for the tag catalogue. The trigger caption is fixed
 * so selecting tags never changes the toolbar width; selection is signalled by
 * the `is-active` highlight only. A typed name without an exact match offers an
 * inline "create" row. Option rows show the chip only, never the comment.
 */
export const TagPicker = ({
  className,
  createLabel,
  emptyMessage,
  hasSelection,
  label,
  layer,
  onCreateTag,
  onSelectedIdsChange,
  options,
  placeholder,
  searchPlaceholder,
  selectedIds,
}: TagPickerProps): ReactElement => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const trimmedQuery = query.trim();
  const visibleOptions = useMemo(() => {
    const key = trimmedQuery.toLocaleUpperCase();
    return key === ''
      ? options
      : options.filter((option) => option.name.toLocaleUpperCase().includes(key));
  }, [options, trimmedQuery]);
  const hasExactMatch =
    trimmedQuery === '' ||
    options.some((option) => option.name.toLocaleLowerCase() === trimmedQuery.toLocaleLowerCase());
  const showCreate = trimmedQuery !== '' && !hasExactMatch;

  const toggle = (id: string): void => {
    onSelectedIdsChange(
      selected.has(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    );
  };

  const create = (): void => {
    if (creating || !showCreate) return;
    setCreating(true);
    void onCreateTag(trimmedQuery).finally(() => setCreating(false));
  };

  return (
    <Popover
      layer={layer}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
      open={open}
      trigger={
        <button
          aria-label={label}
          aria-pressed={hasSelection}
          className={['ui-filter-trigger', hasSelection ? 'is-active' : '', className]
            .filter(Boolean)
            .join(' ')}
          type="button"
        >
          {placeholder}
        </button>
      }
    >
      <div className="tag-picker">
        <TextField
          aria-label={searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          value={query}
        />
        {visibleOptions.length === 0 && !showCreate ? (
          <p className="ui-empty-state">{emptyMessage}</p>
        ) : (
          <div className="tag-picker-viewport" role="listbox">
            {visibleOptions.map((option) => (
              <label className="tag-picker-row" key={option.id}>
                <Checkbox
                  ariaLabel={option.name}
                  checked={selected.has(option.id)}
                  onCheckedChange={() => toggle(option.id)}
                />
                <TagChip
                  color={option.color}
                  label={option.name}
                  title={option.description.trim() === '' ? undefined : option.description}
                />
              </label>
            ))}
          </div>
        )}
        {showCreate ? (
          <button className="tag-picker-create" disabled={creating} onClick={create} type="button">
            <Plus aria-hidden="true" />
            {createLabel(trimmedQuery)}
          </button>
        ) : null}
      </div>
    </Popover>
  );
};
