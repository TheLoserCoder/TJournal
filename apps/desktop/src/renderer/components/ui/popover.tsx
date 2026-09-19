import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { ReactElement, ReactNode } from 'react';

interface PopoverProps {
  readonly children: ReactNode;
  readonly layer?: 'base' | 'dialog';
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly trigger: ReactElement;
}

export const Popover = ({
  children,
  layer = 'base',
  onOpenChange,
  open,
  trigger,
}: PopoverProps): ReactElement => (
  <PopoverPrimitive.Root onOpenChange={onOpenChange} open={open}>
    <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align="end"
        className={`ui-popover-content ui-popover-content-${layer}`}
        collisionPadding={12}
        sideOffset={6}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>
);
