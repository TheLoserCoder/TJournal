import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountDto, InstrumentDto } from '../../../shared/desktop-api';
import { i18n } from '../../i18n';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { AccountAssetEditorDialogs } from './account-asset-editor-dialogs';
import { INSTRUMENT_CATEGORY_LABEL_KEYS } from './entity-table.config';
import type { CatalogPresenter } from './use-catalog-presenter';

const TEST_ACCOUNT: AccountDto = {
  archivedAt: null,
  configuredAssetsCount: 1,
  createdAt: '2026-09-13T12:00:00.000Z',
  currentKnownBalanceUsd: '1000',
  defaultRiskUsd: null,
  id: 'account-1',
  name: 'Main',
  openingBalanceUsd: '1000',
  uncoveredTradeCount: 0,
  updatedAt: '2026-09-13T12:00:00.000Z',
};

const MSFT: InstrumentDto = {
  archivedAt: null,
  calculationProfile: null,
  category: 'forex',
  createdAt: '2026-09-13T12:00:00.000Z',
  id: 'asset-msft',
  source: 'custom',
  symbol: 'MSFT',
  updatedAt: '2026-09-13T12:00:00.000Z',
};

const AAPL: InstrumentDto = {
  archivedAt: null,
  calculationProfile: null,
  category: 'forex',
  createdAt: '2026-09-13T12:00:00.000Z',
  id: 'asset-aapl',
  source: 'custom',
  symbol: 'AAPL',
  updatedAt: '2026-09-13T12:00:00.000Z',
};

/** Ordered by recent use: the picker must preserve the order it receives. */
const TEST_ASSETS: readonly InstrumentDto[] = [MSFT, AAPL];

const READY_ACCOUNT_DRAFT: CatalogPresenter['accountDraft'] = {
  defaults: [
    {
      commissionUsd: '1',
      instrumentId: 'asset-aapl',
      spreadTicks: '2',
      tickSize: '',
      tickValueUsdPerLot: '',
    },
  ],
  name: TEST_ACCOUNT.name,
  openingBalanceUsd: TEST_ACCOUNT.openingBalanceUsd,
};

const createPresenter = (overrides: Partial<CatalogPresenter> = {}): CatalogPresenter => ({
  accountDefaultsStatus: 'ready',
  accountDraft: READY_ACCOUNT_DRAFT,
  accountEditorOpen: true,
  accountError: null,
  accountSaving: false,
  accountsLayout: undefined,
  addAccountDefault: vi.fn(),
  assetEditorOpen: false,
  assetsLayout: undefined,
  bulkBusy: false,
  pendingOperation: null,
  cancelPendingOperation: vi.fn(),
  closeAccountEditor: vi.fn(),
  confirmPendingOperation: vi.fn(),
  requestBulkAction: vi.fn(),
  closeAssetEditor: vi.fn(),
  closeTagEditor: vi.fn(),
  deleteAccount: vi.fn().mockResolvedValue(true),
  deleteAsset: vi.fn().mockResolvedValue(true),
  deleteTag: vi.fn().mockResolvedValue(true),
  deleteTags: vi.fn().mockResolvedValue(true),
  editAccount: vi.fn(),
  editAsset: vi.fn(),
  editTag: vi.fn(),
  editingAccount: TEST_ACCOUNT,
  editingAsset: null,
  editingTag: null,
  openAccountEditor: vi.fn(),
  openAssetEditor: vi.fn(),
  openTagEditor: vi.fn(),
  removeAccountDefault: vi.fn(),
  restoreAccount: vi.fn().mockResolvedValue(true),
  restoreAsset: vi.fn().mockResolvedValue(true),
  retryAccountDefaults: vi.fn(),
  saveAccount: vi.fn().mockResolvedValue(true),
  saveAsset: vi.fn().mockResolvedValue(true),
  saveTag: vi.fn().mockResolvedValue(true),
  setAccountDefaultField: vi.fn(),
  setAccountDraftName: vi.fn(),
  setAccountDraftOpening: vi.fn(),
  setTab: vi.fn(),
  submitAccountDraft: vi.fn().mockResolvedValue(true),
  tab: 'accounts',
  tagEditorOpen: false,
  tagRows: [],
  tagsLayout: undefined,
  updateTableLayout: vi.fn(),
  ...overrides,
});

const renderDialogs = (presenter: CatalogPresenter): void => {
  render(
    <I18nextProvider i18n={i18n}>
      <AccountAssetEditorDialogs assets={TEST_ASSETS} presenter={presenter} />
    </I18nextProvider>,
  );
};

const readAssetInput = async (): Promise<HTMLInputElement> => {
  const input = await screen.findByRole('combobox', { name: i18n.t(TRANSLATION_KEYS.fieldAsset) });
  return input as HTMLInputElement;
};

describe('AccountAssetEditorDialogs cost profiles', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    await i18n.changeLanguage('ru');
    // jsdom does not implement the scrollIntoView Radix Select calls on open.
    Element.prototype.scrollIntoView = () => {};
  });

  it('shows account validation beside the form without trade-specific copy', async () => {
    const presenter = createPresenter({
      accountError: {
        code: 'validation-invalid',
        issues: [{ code: 'invalid_format', path: 'openingBalanceUsd' }],
        retryable: false,
      },
    });
    renderDialogs(presenter);

    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelector('[role="alert"]')).toHaveTextContent(
      i18n.t(TRANSLATION_KEYS.accountValidationFailed),
    );
    expect(dialog.querySelector('[role="alert"]')).toHaveTextContent(
      i18n.t(TRANSLATION_KEYS.fieldAccountOpening),
    );
    expect(dialog.querySelector('[role="alert"]')).toHaveTextContent(
      i18n.t(TRANSLATION_KEYS.accountInvalidOpeningBalance),
    );
  });

  it('opens the asset picker with every asset and keeps the recent-use order', async () => {
    renderDialogs(createPresenter());
    const input = await readAssetInput();
    expect(input.value).toBe('AAPL');

    fireEvent.mouseDown(input);

    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['MSFT', 'AAPL']);
  });

  it('commits the instrument selected from the typed picker and saves the draft', async () => {
    const presenter = createPresenter();
    renderDialogs(presenter);
    const input = await readAssetInput();

    fireEvent.mouseDown(input);
    fireEvent.change(input, { target: { value: 'MS' } });
    fireEvent.click(await screen.findByRole('option', { name: 'MSFT' }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionSave) }));

    await waitFor(() => {
      expect(presenter.setAccountDefaultField).toHaveBeenCalledWith(
        0,
        'instrumentId',
        'asset-msft',
      );
    });
    expect(presenter.submitAccountDraft).toHaveBeenCalledTimes(1);
  });

  it('keeps the current instrument when the typed text matches no asset', async () => {
    const presenter = createPresenter();
    renderDialogs(presenter);
    const input = await readAssetInput();

    fireEvent.change(input, { target: { value: 'ZZZ' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionSave) }));

    await waitFor(() => {
      expect(presenter.submitAccountDraft).toHaveBeenCalledTimes(1);
    });
    expect(presenter.setAccountDefaultField).not.toHaveBeenCalled();
  });

  it('keeps an archived configured asset visible in the picker', async () => {
    const archivedAsset = { ...AAPL, archivedAt: '2026-09-20T00:00:00.000Z' };
    const archivedLabel = `${archivedAsset.symbol} (${i18n.t(TRANSLATION_KEYS.statusArchived)})`;
    const presenter = createPresenter({
      accountDraft: {
        ...READY_ACCOUNT_DRAFT,
        defaults: [
          {
            commissionUsd: '1',
            instrumentId: archivedAsset.id,
            spreadTicks: '2',
            tickSize: '',
            tickValueUsdPerLot: '',
          },
        ],
      },
    });
    render(
      <I18nextProvider i18n={i18n}>
        <AccountAssetEditorDialogs assets={[MSFT, archivedAsset]} presenter={presenter} />
      </I18nextProvider>,
    );

    const input = await readAssetInput();
    expect(input.value).toBe(archivedLabel);

    fireEvent.mouseDown(input);
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['MSFT', archivedLabel]);
  });

  it('disables saving and offers a retry when profiles failed to load', async () => {
    const presenter = createPresenter({
      accountDefaultsStatus: 'error',
      accountDraft: { ...READY_ACCOUNT_DRAFT, defaults: [] },
    });
    renderDialogs(presenter);

    await screen.findByText(i18n.t(TRANSLATION_KEYS.accountDefaultsLoadFailed));
    expect(
      screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionSave) }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: i18n.t(TRANSLATION_KEYS.actionRetry) }));
    expect(presenter.retryAccountDefaults).toHaveBeenCalledTimes(1);
  });

  it('shows localized asset category labels in the asset editor', async () => {
    const presenter = createPresenter({
      accountEditorOpen: false,
      assetEditorOpen: true,
      editingAsset: null,
    });
    renderDialogs(presenter);

    const trigger = await screen.findByRole('combobox', {
      name: i18n.t(TRANSLATION_KEYS.fieldCategory),
    });
    fireEvent.click(trigger);

    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toContain(
      i18n.t(INSTRUMENT_CATEGORY_LABEL_KEYS.crypto),
    );
  });

  it('creates a new account without loading profiles', async () => {
    const presenter = createPresenter({
      accountDraft: { defaults: [], name: 'New', openingBalanceUsd: '500' },
      accountDefaultsStatus: 'idle',
      editingAccount: null,
    });
    renderDialogs(presenter);

    const saveButton = await screen.findByRole('button', {
      name: i18n.t(TRANSLATION_KEYS.actionSave),
    });
    expect(saveButton).toBeEnabled();
    expect(screen.queryByText(i18n.t(TRANSLATION_KEYS.accountCostProfilesTitle))).toBeNull();

    fireEvent.click(saveButton);
    expect(presenter.submitAccountDraft).toHaveBeenCalledTimes(1);
  });
});
