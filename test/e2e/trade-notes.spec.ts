import { test, expect } from '@playwright/test';

import { APP_TEXT } from './app-text';
import {
  completeVaultAndAccountOnboarding,
  createUsdTradeThroughQuickEntry,
  TestApplication,
} from './fixtures';

const TRADE_NOTE_TEST_DATA = {
  entryNote: 'breakout after retest',
  reviewNote: 'waited for confirmation',
  searchTerm: 'CONFIRMATION',
} as const;

let application: TestApplication;

test.beforeEach(async () => {
  application = await TestApplication.launch();
});

test.afterEach(async () => {
  const info = test.info();
  await application.close(info.status !== info.expectedStatus);
});

test('saves, restores and searches trade notes after an application restart', async () => {
  const vaultPath = application.createEmptyVaultDirectory('qualitative-journal');
  await completeVaultAndAccountOnboarding(application, vaultPath, {
    accountName: 'Primary',
    openingBalanceUsd: '1000',
  });
  await createUsdTradeThroughQuickEntry(application, { asset: 'EURUSD', result: '25' });

  const tradeRow = application.page.getByRole('row').filter({ hasText: 'EURUSD' });
  await tradeRow.dblclick();
  const details = application.page.getByRole('dialog');
  await details.getByLabel(APP_TEXT.trade.entryNote).fill(TRADE_NOTE_TEST_DATA.entryNote);
  await details.getByLabel(APP_TEXT.trade.reviewNote).fill(TRADE_NOTE_TEST_DATA.reviewNote);
  await details.getByRole('combobox', { name: APP_TEXT.trade.reviewStatus }).click();
  await application.page
    .getByRole('option', { name: APP_TEXT.trade.reviewReviewed, exact: true })
    .click();
  await details.getByRole('button', { name: APP_TEXT.action.save }).click();
  await expect(details).toBeHidden();

  await application.page.getByRole('button', { name: APP_TEXT.table.layout }).click();
  const layout = application.page.getByRole('dialog');
  await layout.getByRole('checkbox', { name: APP_TEXT.field.identifier }).check();
  await layout.getByRole('button', { name: APP_TEXT.action.apply }).click();

  await application.restart();

  const restoredRow = application.page.getByRole('row').filter({ hasText: 'EURUSD' });
  await expect(restoredRow).toBeVisible();
  await restoredRow.dblclick();
  const restoredDetails = application.page.getByRole('dialog');
  await expect(restoredDetails.getByLabel(APP_TEXT.trade.entryNote)).toHaveValue(
    TRADE_NOTE_TEST_DATA.entryNote,
  );
  await expect(restoredDetails.getByLabel(APP_TEXT.trade.reviewNote)).toHaveValue(
    TRADE_NOTE_TEST_DATA.reviewNote,
  );
  await expect(
    restoredDetails.getByRole('combobox', { name: APP_TEXT.trade.reviewStatus }),
  ).toHaveText(APP_TEXT.trade.reviewReviewed);
  await restoredDetails.getByRole('button', { name: APP_TEXT.action.cancel }).click();

  await application.page.getByRole('button', { name: APP_TEXT.table.filterIdentifier }).click();
  await application.page
    .getByRole('textbox', { name: APP_TEXT.field.identifier })
    .fill(TRADE_NOTE_TEST_DATA.searchTerm);
  await expect(restoredRow).toBeVisible();
});
