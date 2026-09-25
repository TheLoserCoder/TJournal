import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';

import { DialogPortalContainerContext } from './dialog-portal-context';
import { IconButton } from './icon-button';

const restorePreviousFocus = (target: { current: HTMLElement | null }): void => {
  const element = target.current;
  target.current = null;
  if (element?.isConnected) element.focus();
};

interface DialogProps {
  readonly children: ReactNode;
  readonly closeLabel: string;
  readonly contentClassName?: string;
  /**
   * When false the dialog cannot be closed by the user: no close button, and
   * Escape or an outside pointer press are ignored. Used for blocking flows
   * such as vault and account onboarding.
   */
  readonly dismissible?: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly title: string;
}

export const Dialog = ({
  children,
  closeLabel,
  contentClassName,
  dismissible,
  onOpenChange,
  open,
  title,
}: DialogProps): ReactElement => (
  <DialogContent
    children={children}
    closeLabel={closeLabel}
    contentClassName={contentClassName}
    dismissible={dismissible}
    onOpenChange={onOpenChange}
    open={open}
    title={title}
  />
);

const DialogContent = ({
  children,
  closeLabel,
  contentClassName,
  dismissible = true,
  onOpenChange,
  open,
  title,
}: DialogProps): ReactElement => {
  const [contentElement, setContentElement] = useState<HTMLElement | null>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  // Capture the trigger during the first render: Radix moves focus into the
  // dialog in a child effect, so an effect here would already see the dialog.
  if (open && previouslyFocusedElement.current === null) {
    previouslyFocusedElement.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  // Parents often unmount the whole dialog in the same commit that closes it.
  // Restoring focus in this primitive keeps keyboard users anchored to the
  // trigger for every dialog, including conditionally mounted ones.
  useEffect(() => {
    if (open) return undefined;
    return restorePreviousFocus(previouslyFocusedElement);
  }, [open]);
  useEffect(() => () => restorePreviousFocus(previouslyFocusedElement), []);

  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-dialog-overlay" />
        <DialogPrimitive.Content
          className={['ui-dialog-content', contentClassName].filter(Boolean).join(' ')}
          onEscapeKeyDown={(event) => {
            if (!dismissible) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (!dismissible) event.preventDefault();
          }}
          ref={setContentElement}
        >
          <div className="ui-dialog-header">
            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
            {dismissible && (
              <DialogPrimitive.Close asChild>
                <IconButton label={closeLabel} variant="dismiss">
                  <X aria-hidden="true" />
                </IconButton>
              </DialogPrimitive.Close>
            )}
          </div>
          <DialogPortalContainerContext.Provider value={contentElement}>
            {children}
          </DialogPortalContainerContext.Provider>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
