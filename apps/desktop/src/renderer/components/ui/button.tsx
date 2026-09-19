import type { ButtonHTMLAttributes, ReactElement } from 'react';

import { BUTTON_VARIANTS, type ButtonVariant } from './button.config';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
}

export const Button = ({
  className = '',
  variant = BUTTON_VARIANTS.primary,
  ...props
}: ButtonProps): ReactElement => (
  <button {...props} className={`ui-button ui-button-${variant} ${className}`.trim()} />
);
