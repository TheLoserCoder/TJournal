import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesDirectory = resolve(process.cwd(), 'apps/desktop/src/renderer/styles');
const tokensCss = readFileSync(resolve(stylesDirectory, 'design-tokens.css'), 'utf8');
const designSystemCss = readFileSync(resolve(stylesDirectory, 'design-system.css'), 'utf8');

describe('renderer design system contract', () => {
  it('defines independent light and dark semantic mappings', () => {
    expect(tokensCss).toContain(':root {');
    expect(tokensCss).toContain(":root[data-theme='dark']");
    expect(tokensCss).toContain('--color-canvas: var(--ref-neutral-50)');
    expect(tokensCss).toContain('--color-canvas: var(--ref-dark-canvas)');
    expect(tokensCss).toContain('--color-positive-subtle');
    expect(tokensCss).toContain('--color-negative-subtle');
  });

  it('keeps required component roles in the token layer', () => {
    for (const token of [
      '--button-primary-background',
      '--button-secondary-accent-background',
      '--button-accent-ghost-hover',
      '--button-danger-background',
      '--button-dismiss-background',
      '--button-dismiss-idle-background',
      '--button-dismiss-idle-foreground',
      '--button-edit-background',
      '--heading-page-foreground',
      '--heading-section-foreground',
      '--navigation-active-background',
      '--input-border-focus',
      '--table-header-background',
      '--table-row-selected',
      '--table-row-height',
      '--dialog-background',
      '--metric-background',
      '--workspace-section-gap',
      '--workspace-toolbar-height',
      '--overlay-z-dialog-popup',
    ]) {
      expect(tokensCss).toContain(token);
    }
  });

  it('documents reduced motion and the shared visual states', () => {
    expect(tokensCss).toContain('@media (prefers-reduced-motion: reduce)');
    for (const selector of [
      '.ui-button-primary',
      '.ui-text-field',
      '.ui-checkbox',
      '.ui-dialog-content',
      '.data-table',
      '.trade-summary-group',
      '.trade-summary-group-performance',
      '.trade-summary-settings',
      '.trade-summary-item',
      '.trade-result-positive',
      '.trade-result-negative',
    ]) {
      expect(designSystemCss).toContain(selector);
    }
    expect(designSystemCss).not.toContain('transition: all');
    expect(designSystemCss).toContain('.ui-icon-button-dismiss');
    expect(designSystemCss).toContain('.ui-icon-button.is-edit');
    expect(designSystemCss).toContain('.selection-toolbar');
    expect(designSystemCss).toContain('.ui-select-content-dialog');
    expect(designSystemCss).toContain('.ui-time-field');
    expect(designSystemCss).toContain('.ui-direction-toggle');
    expect(designSystemCss).toContain('.ui-calendar-actions');
    expect(designSystemCss).toContain('.data-table tbody tr');
    expect(designSystemCss).not.toContain('.trade-summary-header');
    expect(designSystemCss).not.toContain('.trade-summary-supporting');
    expect(designSystemCss).not.toContain(".trade-summary-item[data-emphasis='hero'] strong");
    expect(designSystemCss).toContain('@keyframes ui-overlay-exit');
  });

  it('keeps Trades vertical rhythm and KPI geometry uniform', () => {
    expect(designSystemCss).toContain('gap: var(--workspace-section-gap)');
    expect(designSystemCss).toContain('.trades-entry-bar');
    expect(designSystemCss).toContain('.trades-entry-bar > .trades-topbar');
    expect(designSystemCss).toContain('.trades-entry-feedback .form-help');
    expect(designSystemCss).toContain('height: var(--workspace-toolbar-height)');
    expect(designSystemCss).not.toContain('var(--table-row-selected-border)');
    expect(designSystemCss).toContain('background: var(--metric-background)');
    expect(designSystemCss).toContain('border: 1px solid var(--metric-border)');
    expect(designSystemCss).toContain('border-radius: var(--ref-radius-md)');
    expect(designSystemCss).not.toContain('font-size: clamp(1.15rem, 2.5vw, 1.75rem)');
  });
});
