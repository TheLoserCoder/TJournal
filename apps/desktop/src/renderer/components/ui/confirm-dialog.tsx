import type { ReactElement } from 'react';

import { Button } from './button';
import { BUTTON_VARIANTS } from './button.config';
import { Dialog } from './dialog';

interface ConfirmDialogProps {
  /**
   * A started server command cannot be cancelled; while it runs the dialog
   * disables both actions so the operation list is not lost mid-flight.
   */
  readonly busy?: boolean;
  readonly cancelLabel: string;
  readonly closeLabel: string;
  readonly confirmLabel: string;
  readonly message: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly title: string;
}

export const ConfirmDialog = ({
  busy = false,
  cancelLabel,
  closeLabel,
  confirmLabel,
  message,
  onCancel,
  onConfirm,
  title,
}: ConfirmDialogProps): ReactElement => (
  <Dialog
    closeLabel={closeLabel}
    onOpenChange={(open) => {
      if (!open && !busy) onCancel();
    }}
    open
    title={title}
  >
    <p>{message}</p>
    <div className="ui-dialog-actions">
      <Button disabled={busy} onClick={onCancel} type="button" variant={BUTTON_VARIANTS.secondary}>
        {cancelLabel}
      </Button>
      <Button disabled={busy} onClick={onConfirm} type="button" variant={BUTTON_VARIANTS.danger}>
        {confirmLabel}
      </Button>
    </div>
  </Dialog>
);
