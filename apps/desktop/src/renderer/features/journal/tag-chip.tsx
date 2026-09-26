import type { HTMLAttributes, ReactElement } from 'react';

import type { TagColorId } from '../../../shared/desktop-api';

interface TagChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  readonly color: TagColorId;
  readonly label: string;
}

/**
 * Colored tag label. The colour is decorative; the text always carries the
 * meaning. Remaining props (including the `ref` and handlers Radix injects when
 * the chip is a tooltip trigger) are forwarded to the element, otherwise a
 * tooltip would never open.
 */
export const TagChip = ({ color, label, ...rest }: TagChipProps): ReactElement => (
  <span className={`tag-chip tag-chip-${color}`} {...rest}>
    {label}
  </span>
);
