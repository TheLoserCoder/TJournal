import { test, expect } from '@playwright/test';

import { APP_TEXT } from './app-text';
import {
  completeVaultAndAccountOnboarding,
  createTradeThroughQuickEntry,
  TestApplication,
} from './fixtures';

/** Locale-independent symbols used by the numeric filter mode selector. */
const FILTER_OPERATOR = { between: '><' } as const;

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

test('filters trades by a numeric result range and rejects a reversed range', async () => {
  const { page } = application;
  await onboard('table-number');
  await createTradeThroughQuickEntry(application, { asset: 'EURUSD', result: '150' });
  await createTradeThroughQuickEntry(application, { asset: 'GBPUSD', result: '50' });

  const eurRow = page.getByRole('row').filter({ hasText: 'EURUSD' });
  const gbpRow = page.getByRole('row').filter({ hasText: 'GBPUSD' });

  await page
    .getByRole('button', { name: APP_TEXT.table.filterColumn(APP_TEXT.field.result) })
    .click();
  await page.getByRole('textbox', { name: APP_TEXT.table.filterMinimum }).fill('100');
  await expect(eurRow).toBeVisible();
  await expect(gbpRow).toBeHidden();

  await page.getByRole('combobox', { name: APP_TEXT.field.result }).click();
  await page.getByRole('option', { name: FILTER_OPERATOR.between, exact: true }).click();
  await page.getByRole('textbox', { name: APP_TEXT.table.filterMinimum }).fill('500');
  await page.getByRole('textbox', { name: APP_TEXT.table.filterMaximum }).fill('100');
  await expect(page.getByRole('alert')).toHaveText(APP_TEXT.table.filterRangeInvalid);

  await page.getByRole('textbox', { name: APP_TEXT.table.filterMinimum }).fill('100');
  await page.getByRole('textbox', { name: APP_TEXT.table.filterMaximum }).fill('200');
  await expect(eurRow).toBeVisible();
  await expect(gbpRow).toBeHidden();

  await page.getByRole('button', { name: APP_TEXT.table.filterResetAll }).click();
  await expect(eurRow).toBeVisible();
  await expect(gbpRow).toBeVisible();
});

test('filters by tags with untagged-or-selected semantics', async () => {
  const { page } = application;
  await onboard('table-tags');

  await page.getByRole('button', { name: APP_TEXT.tag.pickerLabel, exact: true }).click();
  await page.getByRole('textbox', { name: APP_TEXT.table.filterSearch }).fill('Swing');
  await page.getByRole('button', { name: APP_TEXT.tag.createOption('Swing') }).click();
  await page.keyboard.press('Escape');
  await createTradeThroughQuickEntry(application, { asset: 'EURUSD', result: '25' });
  await createTradeThroughQuickEntry(application, { asset: 'GBPUSD', result: '10' });

  const eurRow = page.getByRole('row').filter({ hasText: 'EURUSD' });
  const gbpRow = page.getByRole('row').filter({ hasText: 'GBPUSD' });

  await page.getByRole('button', { name: APP_TEXT.table.filterColumn(APP_TEXT.field.tag) }).click();
  await page.getByRole('checkbox', { name: APP_TEXT.tag.filterUntagged }).check();
  await expect(gbpRow).toBeVisible();
  await expect(eurRow).toBeHidden();

  await page.getByRole('checkbox', { name: 'Swing' }).check();
  await expect(eurRow).toBeVisible();
  await expect(gbpRow).toBeVisible();
});

test('reveals a detail column through the table view dialog', async () => {
  const { page } = application;
  await onboard('table-layout');
  await createTradeThroughQuickEntry(application, { asset: 'EURUSD', result: '25' });

  await page.getByRole('button', { name: APP_TEXT.table.layout }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: APP_TEXT.trade.reviewStatus }).check();
  await dialog.getByRole('button', { name: APP_TEXT.action.apply }).click();
  await expect(dialog).toBeHidden();

  await expect(
    page.getByRole('button', {
      name: APP_TEXT.table.filterColumn(APP_TEXT.trade.reviewStatus),
    }),
  ).toBeVisible();
});

test('deletes a selected trade through the confirmation dialog', async () => {
  const { page } = application;
  await onboard('table-delete');
  await createTradeThroughQuickEntry(application, { asset: 'EURUSD', result: '25' });

  const row = page.getByRole('row').filter({ hasText: 'EURUSD' });
  await row.getByRole('checkbox', { name: APP_TEXT.table.selectRow }).check();
  await page.getByRole('button', { name: APP_TEXT.action.deleteSelected }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(APP_TEXT.table.deleteEntriesTitle)).toBeVisible();
  await dialog.getByRole('button', { name: APP_TEXT.action.delete }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(APP_TEXT.journal.empty)).toBeVisible();
});
