import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';

import type { DesktopApi } from '../../apps/desktop/src/shared/desktop-api';

import { APP_TEXT } from './app-text';

declare global {
  interface Window {
    readonly tjournal: DesktopApi;
  }
}

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const mainEntry = join(repositoryRoot, 'apps', 'desktop', 'out', 'main', 'index.js');
const electronRequire = createRequire(join(repositoryRoot, 'apps', 'desktop', 'package.json'));
const electronExecutable: string = electronRequire('electron');

interface TestWorkspace {
  readonly pickerFilePath: string;
  readonly userDataDirectory: string;
  readonly vaultsDirectory: string;
  readonly workspaceDirectory: string;
}

const createWorkspace = (): TestWorkspace => {
  const workspaceDirectory = mkdtempSync(join(tmpdir(), 'tjournal-e2e-'));
  const userDataDirectory = join(workspaceDirectory, 'user-data');
  const pickerFilePath = join(workspaceDirectory, 'picker-queue.json');
  const vaultsDirectory = join(workspaceDirectory, 'vaults');
  const runtimeDirectory = join(userDataDirectory, 'tjournal-runtime');
  mkdirSync(runtimeDirectory, { recursive: true });
  mkdirSync(vaultsDirectory, { recursive: true });
  writeFileSync(pickerFilePath, '[]', 'utf8');
  // Deterministic language and theme for stable locators.
  writeFileSync(
    join(runtimeDirectory, 'preferences.json'),
    JSON.stringify({ languageMode: 'en', themeMode: 'light' }),
    'utf8',
  );
  return { pickerFilePath, userDataDirectory, vaultsDirectory, workspaceDirectory };
};

const launchElectron = async (
  workspace: TestWorkspace,
): Promise<{ application: ElectronApplication; page: Page }> => {
  const application = await electron.launch({
    args: [mainEntry],
    cwd: repositoryRoot,
    env: {
      ...process.env,
      TJOURNAL_E2E: '1',
      TJOURNAL_E2E_PICKER_FILE: workspace.pickerFilePath,
      TJOURNAL_E2E_USER_DATA_DIR: workspace.userDataDirectory,
    },
    executablePath: electronExecutable,
    timeout: 30_000,
  });
  const page = await application.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { application, page };
};

export class TestApplication {
  private application: ElectronApplication;
  private currentPage: Page;

  private constructor(
    private readonly workspace: TestWorkspace,
    application: ElectronApplication,
    page: Page,
  ) {
    this.application = application;
    this.currentPage = page;
  }

  public static async launch(): Promise<TestApplication> {
    const workspace = createWorkspace();
    const { application, page } = await launchElectron(workspace);
    return new TestApplication(workspace, application, page);
  }

  public get page(): Page {
    return this.currentPage;
  }

  public get vaultsDirectory(): string {
    return this.workspace.vaultsDirectory;
  }

  /** Replaces the picker queue; every vault action consumes the first path. */
  public queuePickerPaths(...paths: readonly string[]): void {
    writeFileSync(this.workspace.pickerFilePath, JSON.stringify(paths), 'utf8');
  }

  public createEmptyVaultDirectory(name: string): string {
    const vaultPath = join(this.workspace.vaultsDirectory, name);
    mkdirSync(vaultPath, { recursive: true });
    return vaultPath;
  }

  /** Resizes the single Electron window; used by compact-layout regression checks. */
  public async resizeWindow(width: number, height: number): Promise<void> {
    await this.application.evaluate(
      async ({ BrowserWindow }, bounds) => {
        const [electronWindow] = BrowserWindow.getAllWindows();
        electronWindow?.setBounds({ height: bounds.height, width: bounds.width });
      },
      { height, width },
    );
  }

  public async restart(): Promise<void> {
    await this.application.close();
    const { application, page } = await launchElectron(this.workspace);
    this.application = application;
    this.currentPage = page;
  }

  public async close(keepWorkspace = false): Promise<void> {
    try {
      await this.application.close();
    } finally {
      if (!keepWorkspace) {
        rmSync(this.workspace.workspaceDirectory, { force: true, recursive: true });
      }
    }
    if (keepWorkspace) {
      console.log(`E2E workspace kept for diagnostics: ${this.workspace.workspaceDirectory}`);
    }
  }
}

export const completeVaultAndAccountOnboarding = async (
  application: TestApplication,
  vaultPath: string,
  options: { readonly accountName: string; readonly openingBalanceUsd: string },
): Promise<void> => {
  const { page } = application;
  application.queuePickerPaths(vaultPath);
  await page.getByRole('button', { name: APP_TEXT.onboarding.create }).click();

  const accountDialog = page.getByRole('dialog');
  await expect(accountDialog.getByText(APP_TEXT.account.onboardingTitle)).toBeVisible();
  await accountDialog.getByLabel(APP_TEXT.field.account).fill(options.accountName);
  await accountDialog.getByLabel(APP_TEXT.field.accountOpening).fill(options.openingBalanceUsd);
  await accountDialog.getByRole('button', { name: APP_TEXT.account.onboardingCreate }).click();
  await expect(accountDialog).toBeHidden();
  await expect(
    page.getByRole('button', { name: APP_TEXT.navigation.trades, exact: true }),
  ).toBeVisible();
};

export const createUsdTradeThroughQuickEntry = async (
  application: TestApplication,
  options: { readonly asset: string; readonly result: string },
): Promise<void> => {
  const { page } = application;
  const assetInput = page.getByRole('combobox', { name: APP_TEXT.field.asset });
  await assetInput.click();
  await assetInput.fill(options.asset);
  await page.getByRole('option', { name: options.asset, exact: true }).click();
  await page
    .getByRole('textbox', { name: APP_TEXT.field.result, exact: true })
    .fill(options.result);
  await page.getByRole('button', { name: APP_TEXT.action.add }).click();
  await expect(page.getByRole('cell', { name: options.asset, exact: true })).toBeVisible();
};

/**
 * Creates a trade through the real quick-entry toolbar, optionally choosing the
 * direction and the result unit first. Only USD and percent units are accepted:
 * an R trade opens the 1R prompt and needs its own scenario.
 */
export const createTradeThroughQuickEntry = async (
  application: TestApplication,
  options: {
    readonly asset: string;
    readonly direction?: 'long' | 'short';
    readonly result: string;
    readonly unit?: 'percent' | 'usd';
  },
): Promise<void> => {
  const { page } = application;
  if (options.direction === 'short') {
    await page.getByRole('button', { name: APP_TEXT.trade.directionShort }).click();
  }
  if (options.unit === 'percent') {
    await page.getByRole('combobox', { name: APP_TEXT.field.unit }).click();
    await page.getByRole('option', { name: APP_TEXT.trade.unitPercent, exact: true }).click();
  }
  const assetInput = page.getByRole('combobox', { name: APP_TEXT.field.asset });
  await assetInput.click();
  await assetInput.fill(options.asset);
  await page.getByRole('option', { name: options.asset, exact: true }).click();
  await page
    .getByRole('textbox', { name: APP_TEXT.field.result, exact: true })
    .fill(options.result);
  await page.getByRole('button', { name: APP_TEXT.action.add }).click();
  await expect(page.getByRole('cell', { name: options.asset, exact: true })).toBeVisible();
};

/**
 * Creates a real vault through a throwaway application instance so it can be
 * opened later by the main test application. The throwaway instance owns its
 * own user data, so recent-vault state of the test application is unaffected.
 */
export const createVaultThroughThrowawayApp = async (vaultPath: string): Promise<void> => {
  const throwaway = await TestApplication.launch();
  try {
    throwaway.queuePickerPaths(vaultPath);
    await throwaway.page.getByRole('button', { name: APP_TEXT.onboarding.create }).click();
    await expect(
      throwaway.page.getByRole('dialog').getByText(APP_TEXT.account.onboardingTitle),
    ).toBeVisible();
  } finally {
    await throwaway.close();
  }
};
