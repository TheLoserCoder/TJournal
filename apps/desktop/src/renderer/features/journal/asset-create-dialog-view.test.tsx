import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../i18n';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { AssetCreateDialogView } from './asset-create-dialog-view';

const renderDialog = (
  overrides: Partial<Parameters<typeof AssetCreateDialogView>[0]> = {},
): {
  readonly onCancel: ReturnType<typeof vi.fn>;
  readonly onConfirm: ReturnType<typeof vi.fn>;
} => {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <AssetCreateDialogView
        category="forex"
        onCancel={onCancel}
        onCategoryChange={vi.fn()}
        onConfirm={onConfirm}
        symbol="BTCUSD"
        {...overrides}
      />
    </I18nextProvider>,
  );
  return { onCancel, onConfirm };
};

describe('AssetCreateDialogView', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    await i18n.changeLanguage('ru');
  });

  it('shows the typed symbol and reflects the chosen asset type', () => {
    renderDialog({ category: 'crypto' });

    expect(
      screen.getByText(i18n.t(TRANSLATION_KEYS.assetCreateConfirmation, { symbol: 'BTCUSD' })),
    ).toBeVisible();
    expect(
      screen.getByRole('combobox', { name: i18n.t(TRANSLATION_KEYS.fieldAssetType) }),
    ).toHaveTextContent(i18n.t(TRANSLATION_KEYS.statisticsCategoryCrypto));
  });

  it('creates the asset on submit and cancels on demand', () => {
    const { onCancel, onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionCreate) }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionCancel) }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
