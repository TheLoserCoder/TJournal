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

const tradesKpi = (count: number): string => `${APP_TEXT.statistics.totalTrades}: ${count}`;

test('shows the report KPIs and applies a direction filter with reset', async () => {
  const { page } = application;
  await onboard('statistics');
  await createTradeThroughQuickEntry(application, { asset: 'EURUSD', result: '100' });
  await createTradeThroughQuickEntry(application, {
    asset: 'GBPUSD',
    direction: 'short',
    result: '50',
  });

  await page.getByRole('button', { name: APP_TEXT.navigation.statistics, exact: true }).click();
  await expect(page.getByRole('group', { name: tradesKpi(2) })).toBeVisible();

  await page.getByRole('button', { name: APP_TEXT.statistics.directions }).click();
  await page.getByRole('checkbox', { name: APP_TEXT.trade.directionLong }).check();
  await expect(page.getByRole('group', { name: tradesKpi(1) })).toBeVisible();

  await page.getByRole('button', { name: APP_TEXT.action.reset }).click();
  await expect(page.getByRole('group', { name: tradesKpi(2) })).toBeVisible();
});
