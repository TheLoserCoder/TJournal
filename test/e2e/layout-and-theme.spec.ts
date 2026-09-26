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

const onboard = async (name: string, openingBalanceUsd = '1000'): Promise<void> => {
  const vaultPath = application.createEmptyVaultDirectory(name);
  await completeVaultAndAccountOnboarding(application, vaultPath, {
    accountName: 'Primary',
    openingBalanceUsd,
  });
};

const openSettings = async (): Promise<void> => {
  await application.page
    .getByRole('button', { name: APP_TEXT.navigation.settings, exact: true })
    .click();
};

test('applies dark, light and auto themes', async () => {
  const { page } = application;
  await onboard('layout-theme');
  await openSettings();

  const themeSelect = page.getByRole('combobox', { name: APP_TEXT.field.theme });
  const currentTheme = (): Promise<string | undefined> =>
    page.evaluate(() => document.documentElement.dataset.theme);

  await themeSelect.click();
  await page.getByRole('option', { name: APP_TEXT.theme.dark, exact: true }).click();
  await expect.poll(currentTheme).toBe('dark');

  await themeSelect.click();
  await page.getByRole('option', { name: APP_TEXT.theme.light, exact: true }).click();
  await expect.poll(currentTheme).toBe('light');

  // Auto resolves to a concrete palette, never the literal "auto".
  await themeSelect.click();
  await page.getByRole('option', { name: APP_TEXT.theme.auto, exact: true }).click();
  await expect.poll(currentTheme).toMatch(/^(light|dark)$/);
});

test('honours prefers-reduced-motion through the duration tokens', async () => {
  const { page } = application;
  await onboard('layout-motion');

  const fastDuration = (): Promise<string> =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ref-duration-fast').trim(),
    );

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await fastDuration()).toBe('1ms');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await fastDuration()).not.toBe('1ms');
});

test('keeps the workspace inside the window at narrow widths', async () => {
  const { page } = application;
  await onboard('layout-narrow');

  const horizontalOverflow = (): Promise<{ content: number; document: number }> =>
    page.evaluate(() => {
      const content = document.querySelector('.page-content');
      return {
        content: content === null ? 0 : content.scrollWidth - content.clientWidth,
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

  for (const width of [800, 620]) {
    await application.resizeWindow(width, 700);
    await expect.poll(async () => (await horizontalOverflow()).document).toBeLessThanOrEqual(1);
    await expect.poll(async () => (await horizontalOverflow()).content).toBeLessThanOrEqual(1);
  }
});

test('keeps an open popup on screen near the window edge', async () => {
  const { page } = application;
  await onboard('layout-popup');
  await application.resizeWindow(800, 700);

  await page.getByRole('button', { name: APP_TEXT.tag.pickerLabel, exact: true }).click();
  const popup = page.locator('[data-radix-popper-content-wrapper]').last();
  await expect(popup).toBeVisible();

  const box = await popup.boundingBox();
  const viewport = await page.evaluate(() => ({
    height: window.innerHeight,
    width: window.innerWidth,
  }));
  expect(box).not.toBeNull();
  if (box !== null) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  }
  await page.keyboard.press('Escape');
});
