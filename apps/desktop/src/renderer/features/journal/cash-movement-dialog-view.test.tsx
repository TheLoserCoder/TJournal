import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountDto, CashMovementDto } from '../../../shared/desktop-api';
import { i18n } from '../../i18n';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { CashMovementDialogView } from './cash-movement-dialog-view';

const ACCOUNT: AccountDto = {
  archivedAt: null,
  configuredAssetsCount: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  currentKnownBalanceUsd: '1000',
  defaultRiskUsd: null,
  id: 'account-1',
  name: 'Primary',
  openingBalanceUsd: '1000',
  uncoveredTradeCount: 0,
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const MOVEMENT: CashMovementDto = {
  accountId: ACCOUNT.id,
  accountName: ACCOUNT.name,
  amountUsd: '50',
  id: 'movement-1',
  kind: 'withdrawal',
  occurredAt: '2026-09-10T12:00:00.000Z',
};

const renderDialog = (onSubmit: (input: unknown) => Promise<boolean>) => {
  const onClose = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <CashMovementDialogView
        accounts={[ACCOUNT]}
        movement={MOVEMENT}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </I18nextProvider>,
  );
  return { onClose };
};

const readAmount = (): HTMLInputElement =>
  screen.getByRole('textbox', { name: i18n.t(TRANSLATION_KEYS.fieldResult) }) as HTMLInputElement;

const clickSave = (): void => {
  fireEvent.click(screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionSave) }));
};

describe('CashMovementDialogView', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    await i18n.changeLanguage('ru');
  });

  it('keeps the dialog and the draft when the save is rejected', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    const { onClose } = renderDialog(onSubmit);

    fireEvent.change(readAmount(), { target: { value: '5000' } });
    clickSave();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ ...MOVEMENT, amountUsd: '5000' });
    expect(onClose).not.toHaveBeenCalled();
    expect(readAmount()).toHaveValue('5000');
  });

  it('closes the dialog after a successful save', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const { onClose } = renderDialog(onSubmit);

    fireEvent.change(readAmount(), { target: { value: '75' } });
    clickSave();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
