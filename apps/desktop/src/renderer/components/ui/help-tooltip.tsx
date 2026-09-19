import { CircleHelp } from 'lucide-react';
import type { ReactElement } from 'react';

import { IconButton } from './icon-button';
import { Tooltip } from './tooltip';

interface HelpTooltipProps {
  readonly content: string;
  readonly label: string;
}

export const HelpTooltip = ({ content, label }: HelpTooltipProps): ReactElement => (
  <Tooltip content={content}>
    <IconButton className="ui-help-tooltip" label={label}>
      <CircleHelp aria-hidden="true" />
    </IconButton>
  </Tooltip>
);
