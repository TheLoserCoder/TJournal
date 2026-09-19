import Decimal from 'decimal.js';

import type { TradeStore } from '../contracts/trade-store';
import type { InstrumentCalculationProfile } from '../domain/trade';
import {
  TRADE_VALIDATION_CODES,
  TradeValidationError,
  type TradeValidationIssue,
} from '../domain/trade-validation';

export class SaveInstrumentProfileUseCase {
  public constructor(private readonly tradeStore: TradeStore) {}
  public execute(profile: InstrumentCalculationProfile): InstrumentCalculationProfile {
    const issues: TradeValidationIssue[] = [];
    for (const [path, value] of [
      ['tickSize', profile.tickSize],
      ['tickValueUsdPerLot', profile.tickValueUsdPerLot],
    ] as const) {
      try {
        if (!new Decimal(value).isPositive())
          issues.push({ code: TRADE_VALIDATION_CODES.mustBePositive, path });
      } catch {
        issues.push({ code: TRADE_VALIDATION_CODES.invalidDecimal, path });
      }
    }
    if (issues.length > 0) throw new TradeValidationError(issues);
    return this.tradeStore.saveInstrumentProfile(profile);
  }
}
