import { Autocomplete } from '@base-ui/react/autocomplete';
import { ChevronDown, Plus } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';

import { useDialogPortalContainer } from './dialog-portal-context';

interface ComboboxProps {
  readonly ariaLabel: string;
  readonly className?: string;
  /** Label of the inline "create" row, interpolated with the typed value. */
  readonly createLabel?: (value: string) => string;
  /** Portal elevation relative to a containing dialog. */
  readonly layer?: 'base' | 'dialog';
  readonly onChange: (value: string) => void;
  /** Commits a typed value that matches no option; the caller owns creation. */
  readonly onCreateOption?: (value: string) => void;
  readonly options: readonly string[];
  readonly placeholder?: string;
  readonly value: string;
}

const matchesQuery = (option: string, query: string): boolean =>
  option.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());

/**
 * Free-text autocomplete. `value` is the committed selection: while the user types,
 * the input keeps its own text so a partial query is not rejected by a parent that
 * only accepts exact matches. An external value change re-syncs the input.
 *
 * The popup opens with the full option list in the order the caller passed, even
 * when the input already holds a committed value: filtering starts only with real
 * typing, so replacing an existing selection never requires clearing the field first.
 */
export const Combobox = ({
  ariaLabel,
  className,
  createLabel,
  layer = 'base',
  onChange,
  onCreateOption,
  options,
  placeholder,
  value,
}: ComboboxProps): ReactElement => {
  const dialogPortalContainer = useDialogPortalContainer();
  const [inputValue, setInputValue] = useState(value);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const visibleOptions =
    query === '' ? options : options.filter((option) => matchesQuery(option, query));
  const typedValue = query.trim();
  const showCreate =
    onCreateOption !== undefined &&
    createLabel !== undefined &&
    typedValue !== '' &&
    !options.some((option) => option.toLocaleLowerCase() === typedValue.toLocaleLowerCase());

  const commitTypedValue = (): void => {
    if (!showCreate) return;
    setInputValue(typedValue);
    setQuery('');
    onCreateOption?.(typedValue);
  };

  return (
    <Autocomplete.Root
      autoHighlight
      filteredItems={visibleOptions}
      items={options}
      onOpenChange={(open, eventDetails) => {
        // A pointer or trigger open shows every option; only typed input filters.
        if (open && eventDetails.reason !== 'input-change') setQuery('');
      }}
      onValueChange={(nextValue, eventDetails) => {
        setInputValue(nextValue);
        setQuery(eventDetails.reason === 'input-change' ? nextValue : '');
        onChange(nextValue);
      }}
      openOnInputClick
      value={inputValue}
    >
      <Autocomplete.InputGroup
        className={['ui-autocomplete-input-group', className].filter(Boolean).join(' ')}
      >
        <Autocomplete.Input
          aria-label={ariaLabel}
          className="ui-text-field ui-autocomplete-input"
          placeholder={placeholder}
        />
        <Autocomplete.Trigger
          aria-label={ariaLabel}
          className="ui-autocomplete-trigger"
          type="button"
        >
          <ChevronDown aria-hidden="true" />
        </Autocomplete.Trigger>
      </Autocomplete.InputGroup>
      <Autocomplete.Portal container={layer === 'dialog' ? dialogPortalContainer : undefined}>
        <Autocomplete.Positioner
          align="start"
          className={`ui-autocomplete-positioner ui-autocomplete-positioner-${layer}`}
          sideOffset={6}
        >
          <Autocomplete.Popup className="ui-autocomplete-popup">
            <Autocomplete.List className="ui-option-list">
              {(option: string) => (
                <Autocomplete.Item className="ui-option" key={option} value={option}>
                  {option}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
            {showCreate ? (
              <button className="ui-autocomplete-create" onClick={commitTypedValue} type="button">
                <Plus aria-hidden="true" />
                {createLabel?.(typedValue)}
              </button>
            ) : null}
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
};
