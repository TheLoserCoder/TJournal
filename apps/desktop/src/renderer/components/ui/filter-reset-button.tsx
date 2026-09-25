import { RotateCcw } from 'lucide-react';
import type { ReactElement } from 'react';

import { IconButton } from './icon-button';
import { Tooltip } from './tooltip';

interface FilterResetButtonProps {
  readonly label: string;
  readonly onReset: () => void;
  readonly visible: boolean;
}

/**
 * Local reset action for one filter panel. It occupies no layout when the
 * filter is still at its default value, so reset never appears as a dead
 * control.
 */
export const FilterResetButton = ({
  label,
  onReset,
  visible,
}: FilterResetButtonProps): ReactElement | null =>
  visible ? (
    <Tooltip content={label}>
      <IconButton label={label} onClick={onReset}>
        <RotateCcw aria-hidden="true" />
      </IconButton>
    </Tooltip>
  ) : null;
