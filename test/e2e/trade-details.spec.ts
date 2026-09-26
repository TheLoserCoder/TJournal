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

test('toggles execution, exits and direction in the trade details dialog', async () => {
  const { page } = application;
  await onboard('trade-details');
  await createTradeThroughQuickEntry(application, { asset: 'EURUSD', result: '25' });

  await page.getByRole('row').filter({ hasText: 'EURUSD' }).dblclick();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(APP_TEXT.trade.details)).toBeVisible();

  await dialog.getByRole('checkbox', { name: APP_TEXT.trade.executionSection }).check();
  await expect(dialog.getByRole('textbox', { name: APP_TEXT.field.entryPrice })).toBeVisible();

  const addExit = dialog.getByRole('button', { name: APP_TEXT.trade.addExit });
  const removeExit = dialog.getByRole('button', { name: APP_TEXT.trade.removeExit });
  await addExit.click();
  await expect(removeExit).toHaveCount(2);
  await removeExit.first().click();
  await expect(removeExit).toHaveCount(1);

  const short = dialog.getByRole('button', { name: APP_TEXT.trade.directionShort });
  const long = dialog.getByRole('button', { name: APP_TEXT.trade.directionLong });
  await short.click();
  await expect(short).toHaveAttribute('aria-pressed', 'true');
  await long.click();
  await expect(long).toHaveAttribute('aria-pressed', 'true');

  await dialog.getByRole('button', { name: APP_TEXT.action.cancel }).click();
  await expect(dialog).toBeHidden();
});
