import type { ReactElement } from 'react';

import type { TagColorId } from '../../../shared/desktop-api';

interface TagChipProps {
  readonly color: TagColorId;
  readonly label: string;
  readonly title?: string;
}

/**
 * Colored tag label. The colour is decorative; the text always carries the
 * meaning. No native title by default: callers add one only where no custom
 * tooltip already covers the chip.
 */
export const TagChip = ({ color, label, title }: TagChipProps): ReactElement => (
  <span className={`tag-chip tag-chip-${color}`} title={title}>
    {label}
  </span>
);
