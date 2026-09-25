import { expect, test } from '@playwright/test';

import { APP_TEXT } from './app-text';
import { analyzeAccessibility } from './accessibility-helper';
import {
  completeVaultAndAccountOnboarding,
  createUsdTradeThroughQuickEntry,
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

const seriousViolations = (
  violations: readonly { readonly impact?: string | null }[],
): readonly { readonly impact?: string | null }[] =>
  violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );

test('has no serious accessibility violations across the main workspaces', async () => {
  const { page } = application;

  await expect(page.getByText(APP_TEXT.onboarding.title)).toBeVisible();
  const onboarding = await analyzeAccessibility(page);
  expect(seriousViolations(onboarding.violations)).toEqual([]);

  const vaultPath = application.createEmptyVaultDirectory('accessibility');
  await completeVaultAndAccountOnboarding(application, vaultPath, {
    accountName: 'Accessibility',
    openingBalanceUsd: '1000',
  });
  await createUsdTradeThroughQuickEntry(application, { asset: 'EURUSD', result: '15' });

  const trades = await analyzeAccessibility(page);
  expect(seriousViolations(trades.violations)).toEqual([]);

  await page.getByRole('checkbox', { name: APP_TEXT.table.selectRow }).first().check();
  await page.getByRole('button', { name: APP_TEXT.action.edit }).click();
  const detailsDialog = page.getByRole('dialog');
  await expect(detailsDialog).toBeVisible();
  const details = await analyzeAccessibility(page);
  expect(seriousViolations(details.violations)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(detailsDialog).toBeHidden();

  await page.getByRole('button', { name: APP_TEXT.navigation.catalog, exact: true }).click();
  const catalog = await analyzeAccessibility(page);
  expect(seriousViolations(catalog.violations)).toEqual([]);

  await page.getByRole('button', { name: APP_TEXT.navigation.statistics, exact: true }).click();
  const statistics = await analyzeAccessibility(page);
  expect(seriousViolations(statistics.violations)).toEqual([]);

  await page.getByRole('button', { name: APP_TEXT.navigation.settings, exact: true }).click();
  const settings = await analyzeAccessibility(page);
  expect(seriousViolations(settings.violations)).toEqual([]);
});

test('keeps the accessible name of icon-first navigation at the minimum window size', async () => {
  const { page } = application;
  const vaultPath = application.createEmptyVaultDirectory('compact-nav');
  await completeVaultAndAccountOnboarding(application, vaultPath, {
    accountName: 'Compact',
    openingBalanceUsd: '1000',
  });

  // The compact sidebar hides the label span; the accessible name must survive.
  await application.resizeWindow(960, 640);
  for (const name of [
    APP_TEXT.navigation.trades,
    APP_TEXT.navigation.catalog,
    APP_TEXT.navigation.statistics,
    APP_TEXT.navigation.settings,
  ]) {
    const item = page.getByRole('button', { name, exact: true });
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute('aria-label', name);
  }
});

test('supports keyboard traversal, row editing and focus restore', async () => {
  const { page } = application;
  const vaultPath = application.createEmptyVaultDirectory('keyboard');
  await completeVaultAndAccountOnboarding(application, vaultPath, {
    accountName: 'Keyboard',
    openingBalanceUsd: '1000',
  });
  await createUsdTradeThroughQuickEntry(application, { asset: 'EURUSD', result: '15' });

  // Toolbar controls and the table scroll region are reachable in order.
  await page.getByRole('button', { name: APP_TEXT.action.add }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: APP_TEXT.trade.withDetails })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: APP_TEXT.table.layout })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('region', { name: APP_TEXT.table.scrollRegion })).toBeFocused();

  // Sidebar actions stay in the tab order.
  await page.getByRole('button', { name: APP_TEXT.action.undo }).focus();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: APP_TEXT.navigation.trades, exact: true }),
  ).toBeFocused();

  // Row editing has a keyboard path; Escape closes and restores focus.
  await page.getByRole('checkbox', { name: APP_TEXT.table.selectRow }).first().check();
  const editButton = page.getByRole('button', { name: APP_TEXT.action.edit });
  await expect(editButton).toBeEnabled();
  await editButton.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(editButton).toBeFocused();
});
