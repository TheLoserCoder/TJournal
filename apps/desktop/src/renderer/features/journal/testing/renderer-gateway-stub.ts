import { vi } from 'vitest';

import { DEFAULT_APPLICATION_SETTINGS } from '../../../../shared/application-settings';
import type {
  AccountDto,
  ApplicationSettingsDto,
  CashMovementDto,
  CommittedDataChangeDto,
  HistoryStateDto,
  InstrumentDto,
  TagDto,
  TradeDto,
  TradePreferencesDto,
} from '../../../../shared/desktop-api';
import { TRADE_DIRECTIONS, TRADE_RESULT_KINDS, TRADE_RESULT_SOURCES } from '@tjournal/trade';

import type { RendererGateway } from '../../../gateway/renderer-gateway';

const TEST_VAULT_PATH = '/renderer-test/vault';
const TEST_TIMESTAMP = '2026-09-21T12:00:00.000Z';

const TEST_INSTRUMENT: InstrumentDto = {
  archivedAt: null,
  calculationProfile: null,
  category: 'forex',
  createdAt: TEST_TIMESTAMP,
  id: 'instrument-test',
  source: 'seed',
  symbol: 'EURUSD',
  updatedAt: TEST_TIMESTAMP,
};
const TEST_ACCOUNT: AccountDto = {
  archivedAt: null,
  configuredAssetsCount: 0,
  createdAt: TEST_TIMESTAMP,
  currentKnownBalanceUsd: '1000',
  defaultRiskUsd: null,
  id: 'account-test',
  name: 'Test account',
  openingBalanceUsd: '1000',
  uncoveredTradeCount: 0,
  updatedAt: TEST_TIMESTAMP,
};
const TEST_TRADE: TradeDto = {
  closedAt: TEST_TIMESTAMP,
  direction: TRADE_DIRECTIONS.long,
  entryNote: null,
  execution: null,
  id: 'trade-test',
  instrumentId: TEST_INSTRUMENT.id,
  instrumentSymbol: TEST_INSTRUMENT.symbol,
  netResultUsd: '10',
  resultKind: TRADE_RESULT_KINDS.cash,
  resultSource: TRADE_RESULT_SOURCES.manual,
  resultValue: '10',
  reviewNote: null,
  reviewStatus: 'unreviewed',
  riskBindingSnapshot: null,
  tagIds: [],
};
const TEST_TAG: TagDto = {
  color: 'blue',
  createdAt: TEST_TIMESTAMP,
  description: '',
  id: 'tag-test',
  name: 'Test tag',
  updatedAt: TEST_TIMESTAMP,
};
const TEST_MOVEMENT: CashMovementDto = {
  accountId: TEST_ACCOUNT.id,
  accountName: TEST_ACCOUNT.name,
  amountUsd: '10',
  id: 'movement-test',
  kind: 'deposit',
  occurredAt: TEST_TIMESTAMP,
};
const EMPTY_HISTORY: HistoryStateDto = {
  canRedo: false,
  canUndo: false,
  redoLabel: null,
  undoLabel: null,
};
const TRADE_PREFERENCES: TradePreferencesDto = {
  neutralCostSettings: { includeCommission: false, includeSpread: false },
  neutralRanges: { cash: null, percent: null, r: null },
  riskBinding: null,
  riskPromptDismissed: false,
};

export interface RendererGatewayStub {
  readonly changes: { emit(change: CommittedDataChangeDto): void };
  readonly gateway: RendererGateway;
}

/** Typed renderer gateway double with a controllable committed-change channel. */
export const createRendererGatewayStub = (): RendererGatewayStub => {
  const listeners = new Set<(change: CommittedDataChangeDto) => void>();
  const settings: ApplicationSettingsDto = DEFAULT_APPLICATION_SETTINGS;
  const gateway: RendererGateway = {
    createAccount: vi.fn().mockResolvedValue({ ok: true, value: TEST_ACCOUNT }),
    createCashMovement: vi.fn().mockResolvedValue({ ok: true, value: TEST_MOVEMENT }),
    createInstrument: vi.fn().mockResolvedValue({ ok: true, value: TEST_INSTRUMENT }),
    createTag: vi.fn().mockResolvedValue({ ok: true, value: TEST_TAG }),
    createTrade: vi.fn().mockResolvedValue({ ok: true, value: TEST_TRADE }),
    createVault: vi.fn().mockResolvedValue({ ok: true, value: null }),
    createVaultBackup: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        id: 'backup',
        kind: 'manual',
        createdAt: TEST_TIMESTAMP,
        sourceVaultId: 'vault',
        databaseBytes: 0,
      },
    }),
    listVaultBackups: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { backups: [], nextCursor: null } }),
    verifyVaultBackup: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        id: 'backup',
        kind: 'manual',
        createdAt: TEST_TIMESTAMP,
        sourceVaultId: 'vault',
        databaseBytes: 0,
      },
    }),
    restoreVaultBackup: vi.fn().mockResolvedValue({ ok: true, value: null }),
    deleteAccount: vi.fn().mockResolvedValue({ ok: true, value: TEST_ACCOUNT }),
    deleteCashMovement: vi.fn().mockResolvedValue({ ok: true, value: TEST_MOVEMENT }),
    deleteInstrument: vi.fn().mockResolvedValue({ ok: true, value: TEST_INSTRUMENT }),
    deleteTags: vi.fn().mockResolvedValue({ ok: true, value: [TEST_TAG] }),
    deleteTrade: vi.fn().mockResolvedValue({ ok: true, value: TEST_TRADE }),
    deleteTrades: vi.fn().mockResolvedValue({ ok: true, value: [TEST_TRADE] }),
    getAnalyticsReport: vi.fn().mockResolvedValue({ ok: true, value: null }),
    getDiagnostics: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        appName: 'TJournal',
        appVersion: '0.1.0',
        logsDirectory: '/logs',
        vaultPath: TEST_VAULT_PATH,
      },
    }),
    getHistory: vi.fn().mockResolvedValue({ ok: true, value: EMPTY_HISTORY }),
    getInstrumentProfile: vi.fn().mockResolvedValue({ ok: true, value: null }),
    getJournalPage: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        nextCursor: null,
        previousCursor: null,
        rows: [],
        totalEntryCount: 0,
        unassignedTradeCount: 0,
      },
    }),
    getSettings: vi.fn().mockResolvedValue({ ok: true, value: settings }),
    getTradePreferences: vi.fn().mockResolvedValue({ ok: true, value: TRADE_PREFERENCES }),
    getTrade: vi.fn().mockResolvedValue({ ok: true, value: TEST_TRADE }),
    getTradeSummary: vi.fn().mockResolvedValue({ ok: true, value: null }),
    listAccountDefaults: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    listAccounts: vi.fn().mockResolvedValue({ ok: true, value: [TEST_ACCOUNT] }),
    listCashMovements: vi.fn().mockResolvedValue({ ok: true, value: [TEST_MOVEMENT] }),
    listInstruments: vi.fn().mockResolvedValue({ ok: true, value: [TEST_INSTRUMENT] }),
    listTags: vi.fn().mockResolvedValue({ ok: true, value: [TEST_TAG] }),
    getTagTradeCounts: vi.fn().mockResolvedValue({ ok: true, value: { [TEST_TAG.id]: 0 } }),
    openVault: vi.fn().mockResolvedValue({ ok: true, value: null }),
    redo: vi.fn().mockResolvedValue({ ok: true, value: EMPTY_HISTORY }),
    restoreAccount: vi.fn().mockResolvedValue({ ok: true, value: TEST_ACCOUNT }),
    restoreInstrument: vi.fn().mockResolvedValue({ ok: true, value: TEST_INSTRUMENT }),
    revealVaultFolder: vi.fn().mockResolvedValue({ ok: true, value: { path: TEST_VAULT_PATH } }),
    subscribeToChanges: vi.fn((listener: (change: CommittedDataChangeDto) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
    undo: vi.fn().mockResolvedValue({ ok: true, value: EMPTY_HISTORY }),
    updateAccount: vi.fn().mockResolvedValue({ ok: true, value: TEST_ACCOUNT }),
    updateCashMovement: vi.fn().mockResolvedValue({ ok: true, value: TEST_MOVEMENT }),
    updateInstrument: vi.fn().mockResolvedValue({ ok: true, value: TEST_INSTRUMENT }),
    updateInstrumentProfile: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        instrumentId: TEST_INSTRUMENT.id,
        tickSize: '0.1',
        tickValueUsdPerLot: '1',
        updatedAt: TEST_TIMESTAMP,
      },
    }),
    updateSettings: vi.fn().mockImplementation(async (input: ApplicationSettingsDto) => ({
      ok: true,
      value: input,
    })),
    updateTag: vi.fn().mockResolvedValue({ ok: true, value: TEST_TAG }),
    updateTrade: vi.fn().mockResolvedValue({ ok: true, value: TEST_TRADE }),
    updateTradePreferences: vi.fn().mockResolvedValue({ ok: true, value: TRADE_PREFERENCES }),
    validateVault: vi.fn().mockResolvedValue({ ok: true, value: { path: TEST_VAULT_PATH } }),
  };
  return {
    changes: {
      emit: (change) => {
        listeners.forEach((listener) => listener(change));
      },
    },
    gateway,
  };
};
