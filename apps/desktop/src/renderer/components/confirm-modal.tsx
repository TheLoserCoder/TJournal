import type { ReactElement } from 'react';
import { Modal } from './modal';

interface ConfirmModalProps {
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly message: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly title: string;
}
export const ConfirmModal = ({
  cancelLabel,
  confirmLabel,
  message,
  onCancel,
  onConfirm,
  title,
}: ConfirmModalProps): ReactElement => (
  <Modal title={title}>
    <p>{message}</p>
    <div className="actions">
      <button className="secondary-button" onClick={onCancel} type="button">
        {cancelLabel}
      </button>
      <button onClick={onConfirm} type="button">
        {confirmLabel}
      </button>
    </div>
  </Modal>
);
