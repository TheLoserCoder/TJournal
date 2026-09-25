import type { CSSProperties } from 'react';

interface ChartTooltipStyles {
  readonly contentStyle: CSSProperties;
  readonly itemStyle: CSSProperties;
  readonly labelStyle: CSSProperties;
}

/**
 * Themed Recharts tooltip surface. Recharts ships a light default (white
 * background, black text) and tints the item by the series stroke, so on the
 * dark theme the value text blends into the popup. Semantic tokens keep both
 * themes legible without overriding Recharts internals.
 */
export const CHART_TOOLTIP_STYLES: ChartTooltipStyles = {
  contentStyle: {
    background: 'var(--color-surface-elevated)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--ref-radius-md)',
    boxShadow: 'var(--ref-shadow-md)',
    color: 'var(--color-text-primary)',
  },
  itemStyle: { color: 'var(--color-text-primary)' },
  labelStyle: { color: 'var(--color-text-secondary)' },
};
