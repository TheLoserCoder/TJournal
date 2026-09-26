import type { ReactElement } from 'react';

import { buildResultShareGradient } from './result-share-gradient';

interface ResultShareRingProps {
  readonly losing: number;
  readonly neutral: number;
  readonly winning: number;
}

/**
 * Compact decorative win/loss/break-even donut for the quick summary. It mirrors
 * the statistics-page distribution ring so both read the same way. The exact win
 * rate and the per-outcome counts are already rendered next to it, so the ring
 * stays hidden from assistive technology.
 */
export const ResultShareRing = ({
  losing,
  neutral,
  winning,
}: ResultShareRingProps): ReactElement => (
  <span
    aria-hidden="true"
    className="ui-result-share-ring"
    style={{ backgroundImage: buildResultShareGradient(winning, losing, neutral) }}
  />
);
