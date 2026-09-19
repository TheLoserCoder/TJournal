import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import type { ReactElement } from 'react';

interface CheckboxProps {
  readonly ariaLabel: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
}

export const Checkbox = ({
  ariaLabel,
  checked,
  disabled = false,
  onCheckedChange,
}: CheckboxProps): ReactElement => (
  <CheckboxPrimitive.Root
    aria-label={ariaLabel}
    checked={checked}
    className="ui-checkbox"
    disabled={disabled}
    onCheckedChange={(value) => onCheckedChange(value === true)}
  >
    <CheckboxPrimitive.Indicator className="ui-checkbox-indicator">
      <Check aria-hidden="true" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);
