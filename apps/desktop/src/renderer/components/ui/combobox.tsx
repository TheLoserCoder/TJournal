import { Autocomplete } from '@base-ui/react/autocomplete';
import { ChevronDown } from 'lucide-react';
import { type ReactElement } from 'react';

import { useDialogPortalContainer } from './dialog-portal-context';

interface ComboboxProps {
  readonly ariaLabel: string;
  readonly className?: string;
  /** Portal elevation relative to a containing dialog. */
  readonly layer?: 'base' | 'dialog';
  readonly onChange: (value: string) => void;
  readonly options: readonly string[];
  readonly placeholder?: string;
  readonly value: string;
}

export const Combobox = ({
  ariaLabel,
  className,
  layer = 'base',
  onChange,
  options,
  placeholder,
  value,
}: ComboboxProps): ReactElement => {
  const dialogPortalContainer = useDialogPortalContainer();

  return (
    <Autocomplete.Root
      autoHighlight
      items={options}
      onValueChange={(nextValue) => {
        if (nextValue !== value) onChange(nextValue);
      }}
      openOnInputClick
      value={value}
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
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
};
