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

const openCatalog = async (): Promise<void> => {
  await application.page
    .getByRole('button', { name: APP_TEXT.navigation.catalog, exact: true })
    .click();
};

test('edits a tag colour and comment from the tag editor', async () => {
  const { page } = application;
  await onboard('catalog-tag');

  await page.getByRole('button', { name: APP_TEXT.tag.pickerLabel, exact: true }).click();
  await page.getByRole('textbox', { name: APP_TEXT.table.filterSearch }).fill('Swing');
  await page.getByRole('button', { name: APP_TEXT.tag.createOption('Swing') }).click();
  await page.keyboard.press('Escape');

  await openCatalog();
  await page.getByRole('button', { name: APP_TEXT.tags.tab, exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'Swing' });
  await expect(row).toBeVisible();
  await row.dblclick();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(APP_TEXT.tag.editTitle)).toBeVisible();
  await dialog.getByRole('radio', { name: APP_TEXT.tag.color.rose }).click();
  await dialog.getByRole('textbox', { name: APP_TEXT.field.tagDescription }).fill('Swing trade');
  await dialog.getByRole('button', { name: APP_TEXT.action.save }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole('cell', { name: 'Swing trade' })).toBeVisible();
});

test('opens the account editor and refuses a negative opening balance', async () => {
  const { page } = application;
  await onboard('catalog-account');

  await openCatalog();
  const row = page.getByRole('row').filter({ hasText: 'Primary' });
  await row.dblclick();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('textbox', { name: APP_TEXT.field.account })).toHaveValue(
    'Primary',
  );
  await dialog.getByRole('textbox', { name: APP_TEXT.field.accountOpening }).fill('-50');
  await dialog.getByRole('button', { name: APP_TEXT.action.save }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText(APP_TEXT.account.validationFailed);
  await expect(page.locator('.page-content > .error-message')).toHaveCount(0);

  await dialog.getByRole('button', { name: APP_TEXT.action.cancel }).click();
  await expect(dialog).toBeHidden();
});

test('archives a linked asset and restores it through the status filter', async () => {
  const { page } = application;
  await onboard('catalog-asset-archive');
  await createTradeThroughQuickEntry(application, { asset: 'EURUSD', result: '25' });

  await openCatalog();
  await page.getByRole('button', { name: APP_TEXT.assets.tab, exact: true }).click();

  const row = page.getByRole('row').filter({ hasText: 'EURUSD' });
  await expect(row).toBeVisible();
  await row.getByRole('checkbox', { name: APP_TEXT.table.selectRow }).check();
  await page.getByRole('button', { name: APP_TEXT.action.deleteSelected }).click();

  const confirm = page.getByRole('dialog');
  await expect(confirm.getByText(APP_TEXT.catalog.deleteConfirmation(1))).toBeVisible();
  await confirm.getByRole('button', { name: APP_TEXT.action.delete }).click();
  await expect(confirm).toBeHidden();

  // Archived assets leave the default active-only view.
  await expect(row).toBeHidden();
  await page
    .getByRole('button', { name: APP_TEXT.table.filterColumn(APP_TEXT.field.status) })
    .click();
  await page.getByRole('checkbox', { name: APP_TEXT.status.archived }).check();
  await expect(row).toBeVisible();
  await expect(row.getByText(APP_TEXT.status.archived)).toBeVisible();

  await row.getByRole('checkbox', { name: APP_TEXT.table.selectRow }).check();
  await page.getByRole('button', { name: APP_TEXT.action.restore }).click();
  // Restore starts immediately from the button; a failure would re-open a
  // retryable dialog instead.
  await expect(row.getByText(APP_TEXT.status.active)).toBeVisible();
});

test('physically deletes an unlinked asset after confirmation', async () => {
  const { page } = application;
  await onboard('catalog-asset-delete');

  await openCatalog();
  await page.getByRole('button', { name: APP_TEXT.assets.tab, exact: true }).click();

  await page.getByRole('textbox', { name: APP_TEXT.field.asset }).fill('TESTX');
  await page.getByRole('button', { name: APP_TEXT.action.add }).click();
  const row = page.getByRole('row').filter({ hasText: 'TESTX' });
  await expect(row).toBeVisible();

  await row.getByRole('checkbox', { name: APP_TEXT.table.selectRow }).check();
  await page.getByRole('button', { name: APP_TEXT.action.deleteSelected }).click();
  const confirm = page.getByRole('dialog');
  await confirm.getByRole('button', { name: APP_TEXT.action.delete }).click();
  await expect(confirm).toBeHidden();
  await expect(row).toBeHidden();
});
