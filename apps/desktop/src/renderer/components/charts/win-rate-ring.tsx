import type { ReactElement } from 'react';

interface WinRateRingProps {
  /** Win rate percentage already computed by the analytics domain (0-100). */
  readonly value: number;
}

const clampPercent = (value: number): number =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

/**
 * Compact donut for a single win-rate percentage. The caller always renders the
 * exact value and label next to it, so the ring is decorative and hidden from
 * assistive technology. The percentage is the domain-provided win rate; the ring
 * never recomputes it from counts.
 */
export const WinRateRing = ({ value }: WinRateRingProps): ReactElement => {
  const share = clampPercent(value);
  return (
    <span
      aria-hidden="true"
      className="ui-win-rate-ring"
      style={{
        backgroundImage: `conic-gradient(from -90deg, var(--color-accent-fill) 0 ${share}%, var(--meter-track-background) ${share}% 100%)`,
      }}
    />
  );
};
