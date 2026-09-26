import { test, expect } from '@playwright/test';

import { APP_TEXT } from './app-text';
import { completeVaultAndAccountOnboarding, TestApplication } from './fixtures';

let application: TestApplication;

test.beforeEach(async () => {
  application = await TestApplication.launch();
});

test.afterEach(async () => {
  const info = test.info();
  await application.close(info.status !== info.expectedStatus);
});

/**
 * The settings page must reflect a chosen theme and language immediately, not
 * only after an unrelated refresh. This is the regression guard for the report
 * that selecting a theme or language on the settings page did nothing.
 */
test('applies the theme and language chosen on the settings page', async () => {
  const { page } = application;
  const vaultPath = application.createEmptyVaultDirectory('settings');
  await completeVaultAndAccountOnboarding(application, vaultPath, {
    accountName: 'Primary',
    openingBalanceUsd: '1000',
  });

  await page.getByRole('button', { name: APP_TEXT.navigation.settings, exact: true }).click();
  await expect(page.getByRole('combobox', { name: APP_TEXT.field.theme })).toBeVisible();

  const themeSelect = page.getByRole('combobox', { name: APP_TEXT.field.theme });
  await themeSelect.click();
  await page.getByRole('option', { name: APP_TEXT.theme.dark }).click();
  // The control itself must show the choice, and the document theme must switch.
  await expect(themeSelect).toHaveText(APP_TEXT.theme.dark);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');

  const languageSelect = page.getByRole('combobox', { name: APP_TEXT.field.language });
  await languageSelect.click();
  await page.getByRole('option', { name: APP_TEXT.language.russian }).click();
  await expect(
    page.getByRole('heading', { name: APP_TEXT.navigation.settingsRussian }),
  ).toBeVisible();
  // The theme must survive the second settings write: it must not revert.
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
});
