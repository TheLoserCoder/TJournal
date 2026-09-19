import { useState } from 'react';

import {
  calculateExecutionResult,
  calculatePercentageRemainder,
} from '@tjournal/trade/calculations';

import type {
  InstrumentCalculationProfileDto,
  TradeDto,
  TradeExecutionInputDto,
} from '../../../shared/desktop-api';
import type { JournalPresenter } from './use-journal-presenter';

const EMPTY_TRADE_ID = '';
const DEFAULT_COMMISSION = '0';
const DEFAULT_SPREAD = '0';
const FULL_POSITION_PERCENT = '100';

const toExecutionDraft = (trade: TradeDto): TradeExecutionInputDto | null =>
  trade.execution === null
    ? null
    : {
        commissionUsd: trade.execution.commissionUsd,
        entryPrice: trade.execution.entryPrice,
        exits: trade.execution.exits,
        quantityLots: trade.execution.quantityLots,
        spreadTicks: trade.execution.spreadTicks,
        stopLossPrice: trade.execution.stopLossPrice,
      };

const withoutExecution = (trade: TradeDto): Omit<TradeDto, 'execution'> => {
  return {
    account: trade.account,
    closedAt: trade.closedAt,
    direction: trade.direction,
    id: trade.id,
    instrumentId: trade.instrumentId,
    instrumentSymbol: trade.instrumentSymbol,
    resultKind: trade.resultKind,
    resultSource: trade.resultSource,
    resultValue: trade.resultValue,
    riskBindingSnapshot: trade.riskBindingSnapshot,
  };
};

export const isTradeEditorDraftUnchanged = (
  currentTrade: TradeDto,
  initialTrade: TradeDto,
  currentExecution: TradeExecutionInputDto | null,
  initialExecution: TradeExecutionInputDto | null,
): boolean =>
  JSON.stringify(withoutExecution(currentTrade)) ===
    JSON.stringify(withoutExecution(initialTrade)) &&
  JSON.stringify(currentExecution) === JSON.stringify(initialExecution);

export interface TradeEditorPresenter {
  readonly editingTrade: TradeDto | null;
  readonly executionDraft: TradeExecutionInputDto | null;
  readonly executionPreview: string | null;
  addExit(): void;
  closeEditor(): void;
  openDetails(): void;
  removeExit(index: number): void;
  setEditingClosedAt(value: string): void;
  setEditingAccountId(value: string | null): void;
  setEditingDirection(value: 'long' | 'short'): void;
  setEditingInstrumentId(value: string): void;
  setEditingResultKind(value: TradeDto['resultKind']): void;
  setEditingResultValue(value: string): void;
  setEditingTrade(trade: TradeDto): void;
  setExecutionEnabled(value: boolean): void;
  setExecutionField(
    field: 'commissionUsd' | 'entryPrice' | 'quantityLots' | 'spreadTicks' | 'stopLossPrice',
    value: string,
  ): void;
  setExitAllocationKind(value: 'lots' | 'percent'): void;
  setExitField(index: number, field: 'allocationValue' | 'exitPrice', value: string): void;
  setExitReportedResult(index: number, kind: 'cash' | 'percent' | null, value: string | null): void;
  submitEditingTrade(): Promise<void>;
}

export const useTradeEditorPresenter = (
  journal: JournalPresenter,
  quick: {
    readonly accountId?: string | null;
    readonly direction: 'long' | 'short';
    readonly resultKind: TradeDto['resultKind'];
    readonly resultValue: string;
    readonly symbol: string;
  },
): TradeEditorPresenter => {
  const [editingTrade, setEditingTrade] = useState<TradeDto | null>(null);
  const [executionDraft, setExecutionDraft] = useState<TradeExecutionInputDto | null>(null);
  const [editingProfile, setEditingProfile] = useState<InstrumentCalculationProfileDto | null>(
    null,
  );
  const [initialEditingTrade, setInitialEditingTrade] = useState<TradeDto | null>(null);
  const [initialExecutionDraft, setInitialExecutionDraft] = useState<TradeExecutionInputDto | null>(
    null,
  );

  const loadEditor = (trade: TradeDto): void => {
    const nextExecutionDraft = toExecutionDraft(trade);
    setEditingTrade(trade);
    setInitialEditingTrade(trade);
    setExecutionDraft(nextExecutionDraft);
    setInitialExecutionDraft(nextExecutionDraft);
    void journal.getInstrumentProfile(trade.instrumentId).then(setEditingProfile);
  };

  const closeEditor = (): void => {
    setEditingTrade(null);
    setExecutionDraft(null);
    setEditingProfile(null);
    setInitialEditingTrade(null);
    setInitialExecutionDraft(null);
  };

  const submitEditingTrade = async (): Promise<void> => {
    if (editingTrade === null) return;
    if (
      editingTrade.id !== EMPTY_TRADE_ID &&
      initialEditingTrade !== null &&
      isTradeEditorDraftUnchanged(
        editingTrade,
        initialEditingTrade,
        executionDraft,
        initialExecutionDraft,
      )
    ) {
      closeEditor();
      return;
    }
    if (editingTrade.id === EMPTY_TRADE_ID) {
      const selected = journal.instruments.find(
        (instrument) => instrument.symbol === editingTrade.instrumentSymbol.toUpperCase(),
      );
      if (selected !== undefined) {
        await journal.createTrade({
          accountId: editingTrade.account?.accountId ?? quick.accountId ?? '',
          direction: editingTrade.direction ?? quick.direction,
          execution: executionDraft,
          instrumentId: selected.id,
          resultKind: editingTrade.resultKind,
          resultValue: editingTrade.resultValue,
        });
      }
    } else {
      const execution =
        executionDraft === null
          ? null
          : editingTrade.execution !== null
            ? { ...executionDraft, instrumentSnapshot: editingTrade.execution.instrumentSnapshot }
            : editingProfile === null
              ? null
              : {
                  ...executionDraft,
                  instrumentSnapshot: {
                    tickSize: editingProfile.tickSize,
                    tickValueUsdPerLot: editingProfile.tickValueUsdPerLot,
                  },
                };
      await journal.updateTrade({ ...editingTrade, execution });
    }
    closeEditor();
  };

  let executionPreview: string | null = null;
  if (
    editingTrade?.direction !== null &&
    editingTrade !== null &&
    executionDraft !== null &&
    editingProfile !== null
  ) {
    try {
      executionPreview = calculateExecutionResult(editingTrade.direction, {
        ...executionDraft,
        instrumentSnapshot: {
          tickSize: editingProfile.tickSize,
          tickValueUsdPerLot: editingProfile.tickValueUsdPerLot,
        },
      }).netUsd;
    } catch {
      executionPreview = null;
    }
  }

  return {
    addExit: () =>
      setExecutionDraft((current) =>
        current === null
          ? current
          : {
              ...current,
              exits: [
                ...current.exits,
                {
                  allocationKind: current.exits[0]?.allocationKind ?? 'percent',
                  allocationValue: DEFAULT_COMMISSION,
                  exitPrice: '',
                  id: crypto.randomUUID(),
                  order: current.exits.length,
                  reportedResultKind: null,
                  reportedResultValue: null,
                },
              ],
            },
      ),
    closeEditor,
    editingTrade,
    executionDraft,
    executionPreview,
    openDetails: () =>
      loadEditor({
        closedAt: new Date().toISOString(),
        account:
          (quick.accountId ?? null) === null
            ? null
            : {
                accountId: quick.accountId ?? '',
                accountName:
                  journal.accounts.find((item) => item.id === quick.accountId)?.name ?? '',
                balanceBeforeUsd: '0',
                balanceImpactUsd: null,
                conversion: null,
              },
        direction: quick.direction,
        execution: null,
        id: EMPTY_TRADE_ID,
        instrumentId: journal.instruments[0]?.id ?? EMPTY_TRADE_ID,
        instrumentSymbol: quick.symbol,
        resultKind: quick.resultKind,
        resultSource: 'manual',
        resultValue: quick.resultValue,
        riskBindingSnapshot: null,
      }),
    removeExit: (index) =>
      setExecutionDraft((current) =>
        current === null
          ? current
          : {
              ...current,
              exits: current.exits
                .filter((_exit, currentIndex) => currentIndex !== index)
                .map((exit, order) => ({ ...exit, order })),
            },
      ),
    setEditingClosedAt: (value) => {
      if (editingTrade !== null)
        setEditingTrade({ ...editingTrade, closedAt: new Date(value).toISOString() });
    },
    setEditingAccountId: (accountId) => {
      if (editingTrade === null) return;
      if (accountId === null) {
        setEditingTrade({ ...editingTrade, account: null });
        return;
      }
      const account = journal.accounts.find((item) => item.id === accountId);
      if (account === undefined) return;
      setEditingTrade({
        ...editingTrade,
        account: {
          accountId: account.id,
          accountName: account.name,
          balanceBeforeUsd: editingTrade.account?.balanceBeforeUsd ?? '0',
          balanceImpactUsd: editingTrade.account?.balanceImpactUsd ?? null,
          conversion: editingTrade.account?.conversion ?? null,
        },
      });
    },
    setEditingDirection: (value) => {
      if (editingTrade !== null) setEditingTrade({ ...editingTrade, direction: value });
    },
    setEditingInstrumentId: (instrumentId) => {
      const instrument = journal.instruments.find((item) => item.id === instrumentId);
      if (editingTrade !== null && instrument !== undefined) {
        setEditingTrade({
          ...editingTrade,
          instrumentId: instrument.id,
          instrumentSymbol: instrument.symbol,
        });
        setExecutionDraft(null);
        void journal.getInstrumentProfile(instrument.id).then(setEditingProfile);
      }
    },
    setEditingResultKind: (resultKind) => {
      if (editingTrade !== null) setEditingTrade({ ...editingTrade, resultKind });
    },
    setEditingResultValue: (resultValue) => {
      if (editingTrade !== null) setEditingTrade({ ...editingTrade, resultValue });
    },
    setEditingTrade: loadEditor,
    setExecutionEnabled: (value) =>
      setExecutionDraft(
        value
          ? {
              commissionUsd: DEFAULT_COMMISSION,
              entryPrice: '',
              exits: [
                {
                  allocationKind: 'percent',
                  allocationValue: FULL_POSITION_PERCENT,
                  exitPrice: '',
                  id: crypto.randomUUID(),
                  order: 0,
                  reportedResultKind: null,
                  reportedResultValue: null,
                },
              ],
              quantityLots: '',
              spreadTicks: DEFAULT_SPREAD,
              stopLossPrice: null,
            }
          : null,
      ),
    setExecutionField: (field, value) =>
      setExecutionDraft((current) =>
        current === null
          ? current
          : { ...current, [field]: field === 'stopLossPrice' && value === '' ? null : value },
      ),
    setExitAllocationKind: (value) =>
      setExecutionDraft((current) =>
        current === null
          ? current
          : {
              ...current,
              exits: current.exits.map((exit) => ({ ...exit, allocationKind: value })),
            },
      ),
    setExitField: (index, field, value) =>
      setExecutionDraft((current) => {
        if (current === null) return current;
        let exits = current.exits.map((exit, currentIndex) =>
          currentIndex === index ? { ...exit, [field]: value } : exit,
        );
        if (field === 'allocationValue' && exits[0]?.allocationKind === 'percent') {
          if (exits.length === 1 && value !== FULL_POSITION_PERCENT && value !== '')
            exits = [
              ...exits,
              {
                ...exits[0],
                allocationValue: calculatePercentageRemainder([value]),
                id: crypto.randomUUID(),
                order: 1,
              },
            ];
          else if (index < exits.length - 1)
            exits = exits.map((exit, currentIndex) =>
              currentIndex === exits.length - 1
                ? {
                    ...exit,
                    allocationValue: calculatePercentageRemainder(
                      exits.slice(0, -1).map((item) => item.allocationValue),
                    ),
                  }
                : exit,
            );
        }
        return { ...current, exits };
      }),
    setExitReportedResult: (index, kind, value) =>
      setExecutionDraft((current) =>
        current === null
          ? current
          : {
              ...current,
              exits: current.exits.map((exit, currentIndex) =>
                currentIndex === index
                  ? { ...exit, reportedResultKind: kind, reportedResultValue: value }
                  : exit,
              ),
            },
      ),
    submitEditingTrade,
  };
};
