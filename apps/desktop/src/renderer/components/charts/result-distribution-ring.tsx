import type { ReactElement } from 'react';

import { buildResultShareGradient } from './result-share-gradient';

interface ResultDistributionRingProps {
  /** Accessible description of the whole figure. */
  readonly label: string;
  readonly losingLabel: string;
  readonly losingTrades: number;
  readonly neutralLabel: string;
  readonly neutralTrades: number;
  readonly winRateLabel: string;
  /** Localized exact win rate, for example `75%` or `—`. */
  readonly winRateText: string;
  readonly winningLabel: string;
  readonly winningTrades: number;
}

/**
 * Win/loss/break-even split as a conic-gradient ring. The exact win rate stays
 * in the middle and every segment is repeated as a labelled count, so colour is
 * never the only signal.
 */
export const ResultDistributionRing = ({
  label,
  losingLabel,
  losingTrades,
  neutralLabel,
  neutralTrades,
  winRateLabel,
  winRateText,
  winningLabel,
  winningTrades,
}: ResultDistributionRingProps): ReactElement => {
  const ringGradient = buildResultShareGradient(winningTrades, losingTrades, neutralTrades);

  const legend = [
    { label: winningLabel, tone: 'positive', value: winningTrades },
    { label: losingLabel, tone: 'negative', value: losingTrades },
    { label: neutralLabel, tone: 'neutral', value: neutralTrades },
  ] as const;

  return (
    <div className="statistics-distribution">
      <div
        aria-label={`${label}: ${winningLabel} ${winningTrades}, ${losingLabel} ${losingTrades}, ${neutralLabel} ${neutralTrades}`}
        className="statistics-ring"
        role="img"
        style={{ backgroundImage: ringGradient }}
      >
        <span className="statistics-ring-center">
          <strong className="ui-numeric">{winRateText}</strong>
          <small>{winRateLabel}</small>
        </span>
      </div>
      <ul className="statistics-legend">
        {legend.map((item) => (
          <li className="statistics-legend-item" key={item.label}>
            <span className="statistics-legend-dot" data-tone={item.tone} />
            <span className="statistics-legend-label">{item.label}</span>
            <strong className="ui-numeric">{item.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
};
