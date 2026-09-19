import type { ButtonHTMLAttributes, ReactElement } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly label: string;
  readonly variant?: 'default' | 'danger' | 'dismiss' | 'edit';
}

export const IconButton = ({
  className = '',
  label,
  variant = 'default',
  ...props
}: IconButtonProps): ReactElement => (
  <button
    {...props}
    aria-label={label}
    className={`ui-icon-button ui-icon-button-${variant} ${className}`.trim()}
    type="button"
  />
);
