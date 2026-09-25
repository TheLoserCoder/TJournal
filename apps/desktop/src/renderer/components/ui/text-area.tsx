import type { ReactElement, TextareaHTMLAttributes } from 'react';

export const TextArea = ({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement => (
  <textarea {...props} className={`ui-text-area ${className}`.trim()} />
);
