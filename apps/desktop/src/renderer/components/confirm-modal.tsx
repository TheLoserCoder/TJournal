import type { ReactElement } from 'react';
import { Modal } from './modal';

interface ConfirmModalProps {
  readonly confirmLabel: string;
  readonly message: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly title: string;
}
export const ConfirmModal = ({
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
        Отмена
      </button>
      <button onClick={onConfirm} type="button">
        {confirmLabel}
      </button>
    </div>
  </Modal>
);
