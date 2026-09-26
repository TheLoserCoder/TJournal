import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesDirectory = resolve(process.cwd(), 'apps/desktop/src/renderer/styles');
const tokensCss = readFileSync(resolve(stylesDirectory, 'design-tokens.css'), 'utf8');
const designSystemCss = readFileSync(resolve(stylesDirectory, 'design-system.css'), 'utf8');
const dataTableCss = readFileSync(resolve(stylesDirectory, 'data-table.css'), 'utf8');
const tradesPageCss = readFileSync(
  resolve(process.cwd(), 'apps/desktop/src/renderer/features/journal/trades-page.css'),
  'utf8',
);
const statisticsPageCss = readFileSync(
  resolve(process.cwd(), 'apps/desktop/src/renderer/features/statistics/statistics-page.css'),
  'utf8',
);

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
      '--button-secondary-hover',
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
      '--table-viewport-min-height',
      '--scrollbar-track',
      '--scrollbar-thumb',
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
    ]) {
      expect(designSystemCss).toContain(selector);
    }
    for (const selector of [
      '.trade-summary-group',
      '.trade-summary-group-performance',
      '.trade-summary-settings',
      '.trade-summary-item',
      '.trade-result-positive',
      '.trade-result-negative',
    ]) {
      expect(tradesPageCss).toContain(selector);
    }
    expect(designSystemCss).not.toContain('transition: all');
    expect(designSystemCss).toContain('.ui-icon-button-dismiss');
    expect(designSystemCss).toContain('.ui-icon-button.is-edit');
    expect(designSystemCss).toContain('.ui-select-content-dialog');
    expect(designSystemCss).toContain('.ui-time-field');
    expect(designSystemCss).toContain('.ui-direction-toggle');
    expect(designSystemCss).toContain('.ui-calendar-actions');
    expect(dataTableCss).toContain('.data-table tbody tr');
    expect(designSystemCss).not.toContain('.trade-summary-header');
    expect(tradesPageCss).not.toContain('.trade-summary-header');
    expect(designSystemCss).not.toContain('.trade-summary-supporting');
    expect(designSystemCss).not.toContain(".trade-summary-item[data-emphasis='hero'] strong");
    expect(designSystemCss).toContain('@keyframes ui-overlay-exit');
  });

  it('keeps Trades vertical rhythm and KPI geometry uniform', () => {
    expect(tradesPageCss).toContain('gap: var(--workspace-section-gap)');
    expect(tradesPageCss).toContain('.trades-entry-bar');
    expect(tradesPageCss).toContain('.trades-entry-layer');
    expect(tradesPageCss).toContain('.trades-entry-feedback .form-help');
    expect(tradesPageCss).toContain('min-height: var(--workspace-toolbar-height)');
    expect(designSystemCss).not.toContain('var(--table-row-selected-border)');
    expect(tradesPageCss).toContain('background: var(--metric-background)');
    expect(tradesPageCss).toContain('border: 1px solid var(--metric-border)');
    expect(tradesPageCss).toContain('border-radius: var(--ref-radius-md)');
    expect(designSystemCss).not.toContain('font-size: clamp(1.15rem, 2.5vw, 1.75rem)');
  });

  it('adapts Trades through container queries instead of viewport breakpoints', () => {
    expect(designSystemCss).toContain('container-type: inline-size');
    expect(tradesPageCss).toContain('@container (max-width: 72rem)');
    expect(tradesPageCss).toContain('@container (max-width: 45rem)');
    expect(tradesPageCss).toContain('.trade-summary-group-assets');
    expect(tradesPageCss).toContain('.trades-topbar');
    expect(designSystemCss).not.toContain('.trades-topbar');
    expect(designSystemCss).not.toContain('.trade-summary {');
    // A wrapped assets row reuses the seven metric tracks of the row above, so
    // every card keeps one width and the tone edges stay aligned in columns.
    expect(tradesPageCss).toContain('grid-template-columns: subgrid');
    expect(tradesPageCss).toContain('grid-column: 1 / span 2');
    expect(tradesPageCss).toContain('repeat(7, minmax(0, 1fr))');
    expect(tradesPageCss).not.toContain('minmax(9rem, 13rem)');
    expect(tradesPageCss).not.toContain('repeat(auto-fit, minmax(7rem, 1fr))');
    expect(tradesPageCss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
  });

  it('keeps DataTable scroll mechanics and sticky header in one owner', () => {
    expect(dataTableCss).toContain('overflow: auto');
    expect(dataTableCss).toContain('position: sticky');
    expect(dataTableCss).toContain('.data-table-empty-state');
    expect(dataTableCss).toContain('scrollbar-color: var(--scrollbar-thumb)');
    expect(dataTableCss).toContain('.data-table-scroll[data-resizing=');
    expect(designSystemCss).not.toContain('.data-table-scroll');
  });

  it('bounds every popup by the space left in the viewport', () => {
    expect(designSystemCss).toContain('--radix-popper-available-height');
    expect(designSystemCss).toContain('--radix-select-content-available-height');
    expect(designSystemCss).toContain('.ui-select-viewport');
    expect(designSystemCss).toContain('overscroll-behavior: contain');
  });

  it('shares one entry type palette between toggles and table badges', () => {
    for (const token of [
      '--entry-type-long-subtle',
      '--entry-type-long-strong',
      '--entry-type-short-subtle',
      '--entry-type-short-strong',
      '--entry-type-deposit-subtle',
      '--entry-type-deposit-strong',
      '--entry-type-withdrawal-subtle',
      '--entry-type-withdrawal-strong',
    ]) {
      expect(tokensCss).toContain(token);
    }
    expect(tokensCss).toContain('--entry-type-long-subtle: var(--color-positive-subtle)');
    expect(tokensCss).toContain('--entry-type-short-subtle: var(--color-negative-subtle)');
    expect(tokensCss).toContain('--entry-type-deposit-subtle: var(--color-violet-subtle)');
    expect(tokensCss).toContain('--entry-type-withdrawal-subtle: var(--color-warning-subtle)');
    expect(designSystemCss).toContain('.entry-type-entry[data-active=');
    expect(tradesPageCss).toContain('background: var(--entry-type-subtle)');
    expect(tradesPageCss).toContain('color: var(--entry-type-strong)');
  });

  it('keeps the filter reset in the toolbar and column header, not in the panel', () => {
    expect(designSystemCss).not.toContain('.ui-filter-panel-actions');
    expect(dataTableCss).not.toContain('.data-table-frame');
    expect(dataTableCss).not.toContain('.data-table-toolbar');
  });

  it('renders the per-column reset next to the funnel only while filtered', () => {
    expect(dataTableCss).toContain('.column-reset-button');
    expect(tradesPageCss).not.toContain('.column-reset-button');
  });

  it('keeps the number filter to one row with a symbol-sized mode selector', () => {
    expect(designSystemCss).toContain('.ui-number-filter-row');
    expect(designSystemCss).toContain('.ui-number-filter-mode');
    expect(designSystemCss).toContain('.ui-number-filter-value');
  });

  it('sizes the quick-entry controls from the grid instead of their own min-width', () => {
    expect(tradesPageCss).toContain('.trades-topbar .ui-select-trigger');
    expect(tradesPageCss).toContain('.trades-topbar .ui-autocomplete-input-group');
    expect(tradesPageCss).toContain('.trades-topbar .ui-text-field');
  });

  it('adds the conversion track only while a percent/R preview exists', () => {
    expect(tradesPageCss).toContain(".trades-topbar-fields:where([data-conversion='true'])");
    expect(tradesPageCss).toContain(".trades-topbar-fields:where([data-entry-kind='movement'])");
    expect(tradesPageCss).toContain('minmax(7rem, max-content)');
    // No control is pinned to a fixed track, so an empty preview leaves no gap
    // between the unit selector and the tag picker.
    expect(tradesPageCss).not.toContain('grid-column: 8');
    expect(tradesPageCss).not.toContain('grid-column: 7');
  });

  it('keeps the trades table full-width, including the empty result of a filter', () => {
    expect(tradesPageCss).toContain('.trades-table-area > .data-table-scroll');
    expect(tradesPageCss).toContain('flex: 1 1 auto');
    expect(tradesPageCss).not.toContain("[data-empty='true']");
  });

  it('keeps the statistics workspace top-aligned and its filter controls compact', () => {
    expect(statisticsPageCss).toContain('align-content: start');
    expect(statisticsPageCss).toContain('padding: var(--statistics-filter-bar-padding)');
    expect(designSystemCss).toContain('.ui-select-trigger.ui-control-compact');
    expect(designSystemCss).toContain('.ui-icon-button.ui-control-compact');
    expect(statisticsPageCss).not.toContain('.statistics-filter-bar .ui-select-trigger');
  });

  it('defines one soft colour role per tag palette entry', () => {
    for (const color of [
      'indigo',
      'blue',
      'cyan',
      'teal',
      'olive',
      'amber',
      'orange',
      'rose',
      'violet',
      'slate',
    ]) {
      expect(tokensCss).toContain(`--tag-${color}-background`);
      expect(tokensCss).toContain(`--tag-${color}-border`);
      expect(tokensCss).toContain(`--tag-${color}-foreground`);
      expect(designSystemCss).toContain(`.tag-chip-${color}`);
    }
    expect(designSystemCss).toContain('.tag-overflow-trigger');
    expect(designSystemCss).toContain('.tag-picker-viewport');
    expect(designSystemCss).toContain('.tag-picker-create');
    expect(designSystemCss).toContain('.tag-selected-list');
    expect(designSystemCss).toContain('.tag-selected-remove');
    expect(designSystemCss).toContain('.ui-autocomplete-create');
    expect(designSystemCss).toContain('.ui-filter-trigger.is-active');
    expect(designSystemCss).toContain('.ui-text-area');
  });

  it('pins the action palette, typography and action contrast tokens', () => {
    for (const token of [
      '--ref-brand-500',
      '--ref-brand-600',
      '--ref-brand-ink',
      '--ref-font-sans',
      '--ref-font-mono',
      '--ref-text-base',
      '--color-accent-fill',
      '--color-accent-ink',
      '--color-info-subtle',
      '--color-chart-quaternary',
      '--meter-track-background',
      '--meter-accent-background',
      '--meter-positive-background',
      '--dialog-border',
      '--dialog-shadow',
      '--table-row-selected-indicator',
      '--navigation-active-indicator',
    ]) {
      expect(tokensCss).toContain(token);
    }
    // Filled controls keep white ink on the blue fill so the primary button passes 4.5:1.
    expect(tokensCss).toContain('--color-accent-ink: var(--ref-brand-ink)');
    expect(tokensCss).toContain('--color-accent-fill: var(--ref-brand-500)');
    // The former thermal-orange accent is gone from the semantic layer.
    expect(tokensCss).not.toContain('--ref-dark-brand: #ff8a5c');
    // The ordinary confirm role is primary; the success variant has no consumer.
    expect(tokensCss).not.toContain('--button-success-');
    expect(designSystemCss).not.toContain('.ui-button-success');
    // Same rule for the removed secondary-accent role: adds and cancels share
    // the neutral secondary treatment.
    expect(tokensCss).not.toContain('--button-secondary-accent-');
    expect(designSystemCss).not.toContain('.ui-button-secondary-accent');
  });

  it('shares one tab, meter and dialog chrome vocabulary', () => {
    expect(designSystemCss).toContain('.ui-tab-list');
    expect(designSystemCss).toContain(".ui-tab[aria-pressed='true']");
    expect(designSystemCss).toContain('.ui-meter-fill[data-tone=');
    expect(designSystemCss).toContain('.ui-numeric');
    // Dialog header and actions are sticky chrome of the dialog scroll container.
    expect(designSystemCss).toContain('.ui-dialog-header {');
    expect(designSystemCss).toContain('.ui-dialog-actions {');
    expect(designSystemCss).toContain('position: sticky');
    expect(designSystemCss).toContain('scrollbar-gutter: stable');
    // Tokenized scrollbars cover dialogs and popups, not only the table.
    expect(designSystemCss).toContain('.ui-dialog-content::-webkit-scrollbar');
    expect(designSystemCss).toContain('.ui-select-viewport::-webkit-scrollbar');
    expect(designSystemCss).toContain('.ui-option-list::-webkit-scrollbar');
    expect(designSystemCss).toContain('scrollbar-color: var(--scrollbar-thumb)');
    expect(designSystemCss).toContain('@keyframes ui-dialog-enter');
  });

  it('renders percentages and numeric readouts through shared tokens', () => {
    expect(statisticsPageCss).toContain('.statistics-performance-layout');
    expect(statisticsPageCss).toContain('.statistics-distribution');
    expect(statisticsPageCss).toContain('.statistics-ring');
    expect(statisticsPageCss).toContain('.statistics-kpi-label');
    expect(statisticsPageCss).toContain('.statistics-kpi-positive');
    // Statistics tables fit their card instead of forcing a horizontal stripe.
    expect(statisticsPageCss).not.toContain('min-width: 42rem');
    expect(statisticsPageCss).toContain('font-family: var(--ref-font-mono)');
    expect(dataTableCss).toContain('font-variant-numeric: tabular-nums');
    expect(dataTableCss).toContain('var(--table-row-selected-indicator)');
    expect(tradesPageCss).toContain('.trade-summary-value');
    expect(designSystemCss).toContain('.ui-win-rate-ring');
    expect(designSystemCss).toContain('.ui-result-share-ring');
    expect(tradesPageCss).toContain('font-family: var(--ref-font-mono)');
  });
});
