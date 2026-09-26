import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

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

test('refuses to create a vault in a non-empty folder', async () => {
  const { page } = application;
  const nonEmpty = application.createEmptyVaultDirectory('not-empty');
  writeFileSync(join(nonEmpty, 'keep.txt'), 'keep', 'utf8');
  application.queuePickerPaths(nonEmpty);

  await page.getByRole('button', { name: APP_TEXT.onboarding.create }).click();
  await expect(page.getByText(APP_TEXT.error.vaultAlreadyInitialized)).toBeVisible();
  await expect(
    page.getByRole('button', { name: APP_TEXT.navigation.trades, exact: true }),
  ).toBeHidden();
});

test('reports an invalid folder when opening a vault', async () => {
  const { page } = application;
  const invalid = application.createEmptyVaultDirectory('invalid');
  application.queuePickerPaths(invalid);

  await page.getByRole('button', { name: APP_TEXT.onboarding.open }).click();
  await expect(page.getByText(APP_TEXT.error.vaultInvalid)).toBeVisible();
});

test('validates the current vault and keeps it when a change candidate is invalid', async () => {
  const { page } = application;
  const vaultPath = application.createEmptyVaultDirectory('vault-validation');
  await completeVaultAndAccountOnboarding(application, vaultPath, {
    accountName: 'Primary',
    openingBalanceUsd: '1000',
  });

  await page.getByRole('button', { name: APP_TEXT.navigation.settings, exact: true }).click();
  await page.getByRole('button', { name: APP_TEXT.settings.vaultCheck }).click();
  await expect(
    page.getByRole('status').filter({ hasText: APP_TEXT.settings.vaultValid }),
  ).toBeVisible();

  const invalid = application.createEmptyVaultDirectory('invalid-candidate');
  application.queuePickerPaths(invalid);
  await page.getByRole('button', { name: APP_TEXT.settings.vaultChange }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: APP_TEXT.error.vaultInvalid }),
  ).toBeVisible();
  // The active vault is unchanged, so the workspace stays mounted.
  await expect(
    page.getByRole('button', { name: APP_TEXT.navigation.trades, exact: true }),
  ).toBeVisible();
});
