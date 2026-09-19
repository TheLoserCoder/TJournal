import type { ReactElement } from 'react';

import { Button } from './button';
import { BUTTON_VARIANTS } from './button.config';
import { Dialog } from './dialog';

interface ConfirmDialogProps {
  readonly cancelLabel: string;
  readonly closeLabel: string;
  readonly confirmLabel: string;
  readonly message: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly title: string;
}

export const ConfirmDialog = ({
  cancelLabel,
  closeLabel,
  confirmLabel,
  message,
  onCancel,
  onConfirm,
  title,
}: ConfirmDialogProps): ReactElement => (
  <Dialog closeLabel={closeLabel} onOpenChange={(open) => !open && onCancel()} open title={title}>
    <p>{message}</p>
    <div className="ui-dialog-actions">
      <Button onClick={onCancel} type="button" variant={BUTTON_VARIANTS.secondary}>
        {cancelLabel}
      </Button>
      <Button onClick={onConfirm} type="button" variant={BUTTON_VARIANTS.danger}>
        {confirmLabel}
      </Button>
    </div>
  </Dialog>
);
