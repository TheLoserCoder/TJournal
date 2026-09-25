import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactElement } from 'react';

export interface SelectOption {
  readonly label: string;
  readonly value: string;
}

interface SelectProps {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly disabled?: boolean;
  /** Portal elevation relative to a containing dialog. */
  readonly layer?: 'base' | 'dialog';
  readonly onValueChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly value: string;
}

export const Select = ({
  ariaLabel,
  className,
  disabled = false,
  layer = 'base',
  onValueChange,
  options,
  placeholder,
  value,
}: SelectProps): ReactElement => (
  <SelectPrimitive.Root disabled={disabled} onValueChange={onValueChange} value={value}>
    <SelectPrimitive.Trigger
      aria-label={ariaLabel}
      className={['ui-select-trigger', className].filter(Boolean).join(' ')}
    >
      <SelectPrimitive.Value placeholder={placeholder}>
        {options.find((option) => option.value === value)?.label}
      </SelectPrimitive.Value>
      <SelectPrimitive.Icon>
        <ChevronDown aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={`ui-select-content ui-select-content-${layer}`}
        collisionPadding={12}
        position="popper"
        sideOffset={6}
      >
        <SelectPrimitive.Viewport>
          {options.map((option) => (
            <SelectPrimitive.Item
              className="ui-select-item"
              key={option.value}
              value={option.value}
            >
              <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator>
                <Check aria-hidden="true" />
              </SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>
          ))}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
);
