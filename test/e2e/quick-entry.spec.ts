import { test, expect } from '@playwright/test';

import { APP_TEXT } from './app-text';
import {
  completeVaultAndAccountOnboarding,
  createTradeThroughQuickEntry,
  TestApplication,
} from './fixtures';

let application: TestApplication;

test.beforeEach(async () => {
  application = await TestApplication.launch();
});

test.afterEach(async () => {
  const info = test.info();
  await application.close(info.status !== info.expectedStatus);
});

const onboard = async (name: string, openingBalanceUsd = '1000'): Promise<void> => {
  const vaultPath = application.createEmptyVaultDirectory(name);
  await completeVaultAndAccountOnboarding(application, vaultPath, {
    accountName: 'Primary',
    openingBalanceUsd,
  });
};

test('previews and saves a percent trade against the current balance', async () => {
  const { page } = application;
  await onboard('quick-entry-percent');

  const assetInput = page.getByRole('combobox', { name: APP_TEXT.field.asset });
  await assetInput.click();
  await assetInput.fill('EURUSD');
  await page.getByRole('option', { name: 'EURUSD', exact: true }).click();
  await page.getByRole('combobox', { name: APP_TEXT.field.unit }).click();
  await page.getByRole('option', { name: APP_TEXT.trade.unitPercent, exact: true }).click();
  await page.getByRole('textbox', { name: APP_TEXT.field.result, exact: true }).fill('10');
  await expect(
    page.getByText(APP_TEXT.trade.conversionPreview('100', 'USD'), { exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: APP_TEXT.action.add }).click();
  await expect(page.getByRole('cell', { name: '100 USD', exact: true })).toBeVisible();
});

test('prompts for 1R on an R trade and rejects a non-positive value', async () => {
  const { page } = application;
  await onboard('quick-entry-risk');

  await page.getByRole('combobox', { name: APP_TEXT.field.unit }).click();
  await page.getByRole('option', { name: APP_TEXT.trade.unitR, exact: true }).click();
  const assetInput = page.getByRole('combobox', { name: APP_TEXT.field.asset });
  await assetInput.click();
  await assetInput.fill('EURUSD');
  await page.getByRole('option', { name: 'EURUSD', exact: true }).click();
  await page.getByRole('textbox', { name: APP_TEXT.field.result, exact: true }).fill('5');
  await page.getByRole('button', { name: APP_TEXT.action.add }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(APP_TEXT.trade.riskMissingTitle)).toBeVisible();
  await dialog.getByLabel(APP_TEXT.trade.oneRiskUsd).fill('0');
  await dialog.getByRole('button', { name: APP_TEXT.action.save }).click();
  await expect(dialog.getByRole('alert')).toHaveText(APP_TEXT.validation.mustBePositive);
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(APP_TEXT.trade.oneRiskUsd).fill('50');
  await dialog.getByRole('button', { name: APP_TEXT.action.save }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('cell', { name: '250 USD', exact: true })).toBeVisible();
});

test('creates a new asset from an unknown symbol and saves the trade', async () => {
  const { page } = application;
  await onboard('quick-entry-asset');

  const assetInput = page.getByRole('combobox', { name: APP_TEXT.field.asset });
  // Fill the result first: the open asset autocomplete popup makes the rest of
  // the toolbar aria-hidden, so the Result field is only reachable while closed.
  await page.getByRole('textbox', { name: APP_TEXT.field.result, exact: true }).fill('10');
  await assetInput.click();
  await assetInput.fill('NEWCO');
  // The open autocomplete popup makes the rest of the page aria-hidden, so the
  // Add button is unreachable by role while it is open; click it by its control class.
  await page.locator('.quick-entry-control-add').click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(APP_TEXT.asset.createConfirmation('NEWCO'))).toBeVisible();
  await dialog.getByRole('combobox', { name: APP_TEXT.field.assetType }).click();
  await page.getByRole('option', { name: APP_TEXT.instrumentCategory.crypto, exact: true }).click();
  await dialog.getByRole('button', { name: APP_TEXT.action.create }).click();

  const row = page.getByRole('row').filter({ hasText: 'NEWCO' });
  await expect(row).toBeVisible();
  await expect(row.getByText(APP_TEXT.instrumentCategory.crypto)).toBeVisible();
});

test('records a deposit and a withdrawal and rejects an over-balance withdrawal', async () => {
  const { page } = application;
  await onboard('quick-entry-cash');

  const entryType = page.getByRole('combobox', { name: APP_TEXT.table.entryType });
  const amount = page.getByRole('textbox', { name: APP_TEXT.field.result, exact: true });

  await entryType.click();
  await page.getByRole('option', { name: APP_TEXT.account.deposit, exact: true }).click();
  await amount.fill('500');
  await page.getByRole('button', { name: APP_TEXT.action.add }).click();
  await expect(page.getByRole('group', { name: 'Accounted balance: 1,500' })).toBeVisible();

  await entryType.click();
  await page.getByRole('option', { name: APP_TEXT.account.withdrawal, exact: true }).click();
  await amount.fill('999999');
  await page.getByRole('button', { name: APP_TEXT.action.add }).click();
  await expect(page.getByText(APP_TEXT.error.insufficientBalance)).toBeVisible();

  await amount.fill('200');
  await page.getByRole('button', { name: APP_TEXT.action.add }).click();
  await expect(page.getByRole('group', { name: 'Accounted balance: 1,300' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: APP_TEXT.account.deposit })).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: APP_TEXT.account.withdrawal }),
  ).toBeVisible();
});

test('creates a tag inline from the quick-entry picker and assigns it', async () => {
  const { page } = application;
  await onboard('quick-entry-tag');

  await page.getByRole('button', { name: APP_TEXT.tag.pickerLabel, exact: true }).click();
  await page.getByRole('textbox', { name: APP_TEXT.table.filterSearch }).fill('Swing');
  await page.getByRole('button', { name: APP_TEXT.tag.createOption('Swing') }).click();
  await page.keyboard.press('Escape');

  await createTradeThroughQuickEntry(application, { asset: 'EURUSD', result: '25' });
  const row = page.getByRole('row').filter({ hasText: 'EURUSD' });
  // The overflow list keeps an aria-hidden measurement copy of every chip, so
  // assert the visible tags cell instead of a single chip.
  await expect(row.getByRole('cell').filter({ hasText: 'Swing' })).toBeVisible();
});
