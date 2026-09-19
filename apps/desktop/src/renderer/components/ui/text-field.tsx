import type { InputHTMLAttributes, ReactElement } from 'react';

export const TextField = ({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>): ReactElement => (
  <input {...props} className={`ui-text-field ${className}`.trim()} />
);
