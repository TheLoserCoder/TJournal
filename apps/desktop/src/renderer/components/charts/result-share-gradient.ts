const EMPTY_TOTAL = 0;
const FULL_SHARE_PERCENT = 100;

const percentOf = (part: number, total: number): number =>
  total === EMPTY_TOTAL ? EMPTY_TOTAL : (part / total) * FULL_SHARE_PERCENT;

const stop = (value: number): string => `${value.toFixed(2)}%`;

/**
 * Conic gradient for the win/loss/break-even split, starting at the top. Shared
 * by the full statistics ring and the compact quick-summary ring so both show
 * the same colour order (green wins, red losses, neutral remainder) and the same
 * segment geometry. An empty journal falls back to a plain track.
 */
export const buildResultShareGradient = (
  winning: number,
  losing: number,
  neutral: number,
): string => {
  const total = winning + losing + neutral;
  if (total === EMPTY_TOTAL) {
    return 'conic-gradient(var(--meter-track-background) 0 100%)';
  }
  const winningShare = percentOf(winning, total);
  const losingShare = winningShare + percentOf(losing, total);
  return `conic-gradient(from -90deg, var(--color-positive) 0 ${stop(winningShare)}, var(--color-negative) ${stop(winningShare)} ${stop(losingShare)}, var(--color-border-strong) ${stop(losingShare)} 100%)`;
};
