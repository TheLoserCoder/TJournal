import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import type { AxeResults } from 'axe-core';
import type { Page } from 'playwright';

const require = createRequire(import.meta.url);
const axeScriptPath: string = require.resolve('axe-core');

declare global {
  interface Window {
    readonly axe: { run(context: Document): Promise<AxeResults> };
  }
}

/**
 * Runs axe-core inside the existing Electron page. The official
 * @axe-core/playwright wrapper is not usable here because Electron cannot open
 * an additional browser context target, and the page CSP blocks inline script
 * tags, so the source is evaluated through the debug protocol instead.
 * Overlay entrance animations are awaited first: sampling blended colors
 * mid-transition produces false colour-contrast violations.
 */
export const analyzeAccessibility = async (page: Page): Promise<AxeResults> => {
  await page.evaluate(async () => {
    await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));
  });
  const axeSource = readFileSync(axeScriptPath, 'utf8');
  await page.evaluate(axeSource);
  return page.evaluate(() => window.axe.run(document));
};
