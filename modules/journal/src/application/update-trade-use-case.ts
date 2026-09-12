import { normalizeDecimal } from '@tjournal/platform-numeric';

import type { JournalStorage } from '../contracts/journal-storage';
import type { ClosedTrade } from '../domain/closed-trade';

export class UpdateTradeUseCase {
  public constructor(private readonly journalStorage: JournalStorage) {}

  public execute(trade: ClosedTrade): ClosedTrade {
    return this.journalStorage.updateTrade({
      ...trade,
      resultValue: normalizeDecimal(trade.resultValue),
    });
  }
}
