import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';

import { DialogPortalContainerContext } from './dialog-portal-context';
import { IconButton } from './icon-button';

interface DialogProps {
  readonly children: ReactNode;
  readonly closeLabel: string;
  readonly contentClassName?: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly title: string;
}

export const Dialog = ({
  children,
  closeLabel,
  contentClassName,
  onOpenChange,
  open,
  title,
}: DialogProps): ReactElement => (
  <DialogContent
    children={children}
    closeLabel={closeLabel}
    contentClassName={contentClassName}
    onOpenChange={onOpenChange}
    open={open}
    title={title}
  />
);

const DialogContent = ({
  children,
  closeLabel,
  contentClassName,
  onOpenChange,
  open,
  title,
}: DialogProps): ReactElement => {
  const [contentElement, setContentElement] = useState<HTMLElement | null>(null);

  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-dialog-overlay" />
        <DialogPrimitive.Content
          className={['ui-dialog-content', contentClassName].filter(Boolean).join(' ')}
          ref={setContentElement}
        >
          <div className="ui-dialog-header">
            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton label={closeLabel} variant="dismiss">
                <X aria-hidden="true" />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          <DialogPortalContainerContext.Provider value={contentElement}>
            {children}
          </DialogPortalContainerContext.Provider>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
