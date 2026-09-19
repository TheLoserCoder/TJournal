import type { CashMovementDto, TradeDto } from '../../../shared/desktop-api';

export type JournalEntryRow =
  | {
      readonly kind: 'trade';
      readonly occurredAt: string;
      readonly trade: TradeDto;
      readonly id: string;
    }
  | {
      readonly kind: CashMovementDto['kind'];
      readonly movement: CashMovementDto;
      readonly occurredAt: string;
      readonly id: string;
    };

const TRADE_ROW_PREFIX = 'trade:';
const CASH_MOVEMENT_ROW_PREFIX = 'cash-movement:';

export const toJournalEntryRows = (
  trades: readonly TradeDto[],
  cashMovements: readonly CashMovementDto[],
  includeCashMovements: boolean,
): readonly JournalEntryRow[] => [
  ...trades.map((trade) => ({
    id: `${TRADE_ROW_PREFIX}${trade.id}`,
    kind: 'trade' as const,
    occurredAt: trade.closedAt,
    trade,
  })),
  ...(includeCashMovements
    ? cashMovements.map((movement) => ({
        id: `${CASH_MOVEMENT_ROW_PREFIX}${movement.id}`,
        kind: movement.kind,
        movement,
        occurredAt: movement.occurredAt,
      }))
    : []),
];
