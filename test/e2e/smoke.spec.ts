import { test, expect } from '@playwright/test';

import { APP_TEXT } from './app-text';
import {
  completeVaultAndAccountOnboarding,
  createUsdTradeThroughQuickEntry,
  createVaultThroughThrowawayApp,
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

test('blocks the workspace until a vault and an account exist', async () => {
  const { page } = application;
  const vaultPath = application.createEmptyVaultDirectory('primary');

  await expect(
    page.getByRole('button', { name: APP_TEXT.navigation.trades, exact: true }),
  ).toBeHidden();
  await expect(page.getByText(APP_TEXT.onboarding.title)).toBeVisible();

  // Blocking onboarding must ignore Escape.
  await page.keyboard.press('Escape');
  await expect(page.getByText(APP_TEXT.onboarding.title)).toBeVisible();

  application.queuePickerPaths(vaultPath);
  await page.getByRole('button', { name: APP_TEXT.onboarding.create }).click();

  const accountDialog = page.getByRole('dialog');
  await expect(accountDialog.getByText(APP_TEXT.account.onboardingTitle)).toBeVisible();
  await expect(
    page.getByRole('button', { name: APP_TEXT.navigation.trades, exact: true }),
  ).toBeHidden();

  await accountDialog.getByLabel(APP_TEXT.field.account).fill('Primary');
  await accountDialog.getByLabel(APP_TEXT.field.accountOpening).fill('1000');
  await accountDialog.getByRole('button', { name: APP_TEXT.account.onboardingCreate }).click();

  await expect(accountDialog).toBeHidden();
  await expect(page.getByText(APP_TEXT.journal.empty)).toBeVisible();
});

test('records a USD trade that survives an application restart', async () => {
  const vaultPath = application.createEmptyVaultDirectory('primary');
  await completeVaultAndAccountOnboarding(application, vaultPath, {
    accountName: 'Primary',
    openingBalanceUsd: '1000',
  });
  await createUsdTradeThroughQuickEntry(application, { asset: 'EURUSD', result: '25' });

  await application.restart();

  await expect(application.page.getByRole('cell', { name: 'EURUSD', exact: true })).toBeVisible();
  await expect(application.page.getByRole('cell', { name: '+25 USD', exact: true })).toBeVisible();
});

test('backs up, restarts, restores into a new vault and opens the original data', async () => {
  const source = application.createEmptyVaultDirectory('backup-source');
  await completeVaultAndAccountOnboarding(application, source, {
    accountName: 'Primary',
    openingBalanceUsd: '1000',
  });
  await createUsdTradeThroughQuickEntry(application, { asset: 'EURUSD', result: '25' });
  await application.page
    .getByRole('button', { name: APP_TEXT.navigation.settings, exact: true })
    .click();
  await application.page.getByRole('button', { name: APP_TEXT.settings.backup }).click();
  await expect(application.page.getByText(APP_TEXT.settings.backupSuccess)).toBeVisible();

  await application.restart();
  await application.page
    .getByRole('button', { name: APP_TEXT.navigation.settings, exact: true })
    .click();
  const restored = application.createEmptyVaultDirectory('restored-copy');
  application.queuePickerPaths(restored);
  await application.page.getByRole('button', { name: APP_TEXT.settings.restore }).click();
  await expect(application.page.getByText(APP_TEXT.settings.restoreSuccess)).toBeVisible();
  application.queuePickerPaths(restored);
  await application.page.getByRole('button', { name: APP_TEXT.settings.vaultChange }).click();
  await application.page
    .getByRole('button', { name: APP_TEXT.navigation.trades, exact: true })
    .click();
  await expect(application.page.getByRole('cell', { name: 'EURUSD', exact: true })).toBeVisible();
  await expect(application.page.getByRole('cell', { name: '+25 USD', exact: true })).toBeVisible();
});

test('undoes and redoes a saved trade', async () => {
  const vaultPath = application.createEmptyVaultDirectory('primary');
  await completeVaultAndAccountOnboarding(application, vaultPath, {
    accountName: 'Primary',
    openingBalanceUsd: '1000',
  });
  await createUsdTradeThroughQuickEntry(application, { asset: 'EURUSD', result: '25' });

  await application.page.getByRole('button', { name: APP_TEXT.action.undo }).click();
  await expect(application.page.getByText(APP_TEXT.journal.empty)).toBeVisible();

  await application.page.getByRole('button', { name: APP_TEXT.action.redo }).click();
  await expect(application.page.getByRole('cell', { name: 'EURUSD', exact: true })).toBeVisible();
});

test('converts a percent trade and rejects an excessive withdrawal', async () => {
  const vaultPath = application.createEmptyVaultDirectory('primary');
  await completeVaultAndAccountOnboarding(application, vaultPath, {
    accountName: 'Primary',
    openingBalanceUsd: '1000',
  });

  const outcome = await application.page.evaluate(async () => {
    const accounts = await window.tjournal.accounts.list();
    const instruments = await window.tjournal.instruments.list();
    if (!accounts.ok || !instruments.ok) throw new Error('Fixture data is missing.');
    const account = accounts.value[0];
    const instrument = instruments.value.find((item) => item.symbol === 'EURUSD');
    if (account === undefined || instrument === undefined) {
      throw new Error('Fixture data is missing.');
    }
    const occurredAt = new Date().toISOString();
    const percentTrade = await window.tjournal.trades.create({
      accountId: account.id,
      closedAt: occurredAt,
      direction: 'long',
      execution: null,
      instrumentId: instrument.id,
      resultKind: 'percent',
      resultValue: '10',
    });
    const deposit = await window.tjournal.cashMovements.create({
      accountId: account.id,
      amountUsd: '100',
      kind: 'deposit',
      occurredAt,
    });
    const excessiveWithdrawal = await window.tjournal.cashMovements.create({
      accountId: account.id,
      amountUsd: '5000',
      kind: 'withdrawal',
      occurredAt,
    });
    const validWithdrawal = await window.tjournal.cashMovements.create({
      accountId: account.id,
      amountUsd: '50',
      kind: 'withdrawal',
      occurredAt,
    });
    const report = await window.tjournal.analytics.report({
      breakdown: { dimension: 'instrument', limit: 50, metric: 'net-result' },
      filters: {
        accountIds: [],
        categories: [],
        directions: [],
        includeUnassigned: false,
        instrumentIds: [],
      },
      range: { fromInclusive: null, toExclusive: null },
      timeGrain: 'auto',
    });
    return { deposit, excessiveWithdrawal, percentTrade, report, validWithdrawal };
  });

  expect(outcome.percentTrade.ok).toBe(true);
  if (outcome.percentTrade.ok) {
    expect(outcome.percentTrade.value.netResultUsd).toBe('100');
  }
  expect(outcome.deposit.ok).toBe(true);
  expect(outcome.excessiveWithdrawal.ok).toBe(false);
  if (!outcome.excessiveWithdrawal.ok) {
    expect(outcome.excessiveWithdrawal.error.code).toBe('validation-invalid');
  }
  expect(outcome.validWithdrawal.ok).toBe(true);
  expect(outcome.report.ok).toBe(true);
  if (outcome.report.ok && outcome.report.value !== null) {
    expect(outcome.report.value.kpis.netResultUsd).toBe('100');
  }
  await expect(application.page.getByRole('cell', { name: 'EURUSD', exact: true })).toBeVisible();
});

test('loads additional pages when the table is scrolled', async () => {
  const vaultPath = application.createEmptyVaultDirectory('paging');
  await completeVaultAndAccountOnboarding(application, vaultPath, {
    accountName: 'Paging',
    openingBalanceUsd: '1000',
  });

  await application.page.evaluate(async () => {
    const accounts = await window.tjournal.accounts.list();
    const instruments = await window.tjournal.instruments.list();
    if (!accounts.ok || !instruments.ok) throw new Error('Fixture data is missing.');
    const account = accounts.value[0];
    const instrument = instruments.value.find((item) => item.symbol === 'EURUSD');
    if (account === undefined || instrument === undefined) {
      throw new Error('Fixture data is missing.');
    }
    for (let index = 0; index < 120; index += 1) {
      await window.tjournal.trades.create({
        accountId: account.id,
        closedAt: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString(),
        direction: 'long',
        execution: null,
        instrumentId: instrument.id,
        resultKind: 'cash',
        resultValue: String(index),
      });
    }
  });

  const oldestCell = application.page.getByRole('cell', { name: '0 USD', exact: true });
  const scrollRegion = application.page.getByRole('region', {
    name: APP_TEXT.table.scrollRegion,
  });
  await expect
    .poll(
      async () => {
        await scrollRegion.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        return oldestCell.isVisible().catch(() => false);
      },
      { timeout: 45_000 },
    )
    .toBe(true);
});

test('clears undo history when another vault is opened', async () => {
  const primaryVaultPath = application.createEmptyVaultDirectory('primary');
  await completeVaultAndAccountOnboarding(application, primaryVaultPath, {
    accountName: 'Primary',
    openingBalanceUsd: '1000',
  });
  await createUsdTradeThroughQuickEntry(application, { asset: 'EURUSD', result: '25' });

  const secondaryVaultPath = application.createEmptyVaultDirectory('secondary');
  await createVaultThroughThrowawayApp(secondaryVaultPath);
  application.queuePickerPaths(secondaryVaultPath);
  await application.page
    .getByRole('button', { name: APP_TEXT.navigation.settings, exact: true })
    .click();
  await application.page.getByRole('button', { name: APP_TEXT.settings.vaultChange }).click();

  const accountDialog = application.page.getByRole('dialog');
  await expect(accountDialog.getByText(APP_TEXT.account.onboardingTitle)).toBeVisible();

  const historyState = await application.page.evaluate(() => window.tjournal.history.getState());
  expect(historyState).toEqual({
    ok: true,
    value: { canRedo: false, canUndo: false, redoLabel: null, undoLabel: null },
  });
  const page = await application.page.evaluate(() =>
    window.tjournal.trades.page({
      cursor: null,
      filters: {
        accountIds: [],
        categories: [],
        closedFromDate: null,
        closedToDate: null,
        detailBounds: null,
        entryKinds: [],
        includeUntagged: false,
        includeUnassigned: false,
        instrumentIds: [],
        notePresence: [],
        occurredFrom: null,
        occurredTo: null,
        resultBounds: null,
        resultUnits: [],
        reviewStatuses: [],
        tagIds: [],
        textQuery: null,
      },
      includeCashMovements: true,
      limit: 10,
      sort: { direction: 'desc', field: 'date' },
    }),
  );
  expect(page.ok).toBe(true);
  if (page.ok) {
    expect(page.value.rows).toEqual([]);
    expect(page.value.totalEntryCount).toBe(0);
  }
});
