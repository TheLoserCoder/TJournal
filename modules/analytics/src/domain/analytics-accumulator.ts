import Decimal from 'decimal.js';

import { TRADE_RESULT_TONES, classifyTradeResultValue, type NeutralRange } from '@tjournal/trade';

import type { AnalyticsTradeFact } from '../contracts/analytics-fact-source';
import type { AnalyticsBreakdownRow } from './analytics-report';

const ZERO = new Decimal(0);

export class AnalyticsAccumulator {
  private averageTradeUsd: Decimal | null = null;
  private coveredTrades = 0;
  private cumulative = ZERO;
  private grossLossMagnitude = ZERO;
  private grossProfit = ZERO;
  private losingTrades = 0;
  private maxDrawdown = ZERO;
  private neutralTrades = 0;
  private runningPeak = ZERO;
  private totalTrades = 0;
  private winningTrades = 0;

  public constructor(private readonly neutralRange: NeutralRange | null) {}

  public add(fact: AnalyticsTradeFact): void {
    this.totalTrades += 1;
    if (fact.netResultUsd === null) return;
    const value = new Decimal(fact.netResultUsd);
    this.coveredTrades += 1;
    this.cumulative = this.cumulative.plus(value);
    if (value.isPositive()) this.grossProfit = this.grossProfit.plus(value);
    if (value.isNegative()) this.grossLossMagnitude = this.grossLossMagnitude.plus(value.abs());
    this.classify(value);
    if (this.cumulative.greaterThan(this.runningPeak)) this.runningPeak = this.cumulative;
    const drawdown = this.runningPeak.minus(this.cumulative);
    if (drawdown.greaterThan(this.maxDrawdown)) this.maxDrawdown = drawdown;
    this.averageTradeUsd = this.cumulative.div(this.coveredTrades);
  }

  public toBreakdownRow(id: string, label: string): AnalyticsBreakdownRow {
    return {
      averageTradeUsd: this.averageTradeUsd?.toString() ?? null,
      coveredTrades: this.coveredTrades,
      id,
      label,
      losingTrades: this.losingTrades,
      maxDrawdownUsd: this.coveredTrades === 0 ? null : this.maxDrawdown.toString(),
      netResultUsd: this.cumulative.toString(),
      neutralTrades: this.neutralTrades,
      profitFactor: this.profitFactor(),
      totalTrades: this.totalTrades,
      winRatePercent: this.winRatePercent(),
      winningTrades: this.winningTrades,
    };
  }

  public toKpis(): {
    readonly averageTradeUsd: string | null;
    readonly grossLossMagnitudeUsd: string | null;
    readonly grossProfitUsd: string | null;
    readonly losingTrades: number;
    readonly maxDrawdownUsd: string | null;
    readonly netResultUsd: string | null;
    readonly neutralTrades: number;
    readonly profitFactor: string | null;
    readonly winRatePercent: string | null;
    readonly winningTrades: number;
  } {
    return {
      averageTradeUsd: this.averageTradeUsd?.toString() ?? null,
      grossLossMagnitudeUsd: this.coveredTrades === 0 ? null : this.grossLossMagnitude.toString(),
      grossProfitUsd: this.coveredTrades === 0 ? null : this.grossProfit.toString(),
      losingTrades: this.losingTrades,
      maxDrawdownUsd: this.coveredTrades === 0 ? null : this.maxDrawdown.toString(),
      netResultUsd: this.coveredTrades === 0 ? null : this.cumulative.toString(),
      neutralTrades: this.neutralTrades,
      profitFactor: this.profitFactor(),
      winRatePercent: this.winRatePercent(),
      winningTrades: this.winningTrades,
    };
  }

  public get coverage(): { readonly coveredTrades: number; readonly totalTrades: number } {
    return { coveredTrades: this.coveredTrades, totalTrades: this.totalTrades };
  }

  private classify(value: Decimal): void {
    const tone = classifyTradeResultValue(value.toString(), this.neutralRange);
    if (tone === TRADE_RESULT_TONES.positive) this.winningTrades += 1;
    else if (tone === TRADE_RESULT_TONES.negative) this.losingTrades += 1;
    else this.neutralTrades += 1;
  }

  private profitFactor(): string | null {
    return this.grossLossMagnitude.isZero()
      ? null
      : this.grossProfit.div(this.grossLossMagnitude).toString();
  }

  private winRatePercent(): string | null {
    const decidedTrades = this.winningTrades + this.losingTrades;
    return decidedTrades === 0
      ? null
      : new Decimal(this.winningTrades).div(decidedTrades).mul(100).toString();
  }
}
