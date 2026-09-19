import type { RendererGateway } from './renderer-gateway';

export const createElectronRendererGateway = (): RendererGateway => ({
  getDiagnostics: () =>
    window.tjournal.diagnostics.getStatus?.() ??
    Promise.resolve({
      ok: true as const,
      value: { appName: '', appVersion: '', logsDirectory: '', vaultPath: null },
    }),
  subscribeToChanges: (listener) => window.tjournal.changes?.subscribe(listener) ?? (() => {}),
  createInstrument: (input) => window.tjournal.instruments.create(input),
  updateInstrument: (input) => window.tjournal.instruments.update(input),
  deleteInstrument: (id) => window.tjournal.instruments.delete(id),
  restoreInstrument: (id) => window.tjournal.instruments.restore(id),
  createAccount: (input) => window.tjournal.accounts.create(input),
  listAccounts: () => window.tjournal.accounts.list(),
  updateAccount: (input) => window.tjournal.accounts.update(input),
  deleteAccount: (id) => window.tjournal.accounts.delete(id),
  restoreAccount: (id) => window.tjournal.accounts.restore(id),
  listAccountDefaults: (id) => window.tjournal.accounts.defaults(id),
  createCashMovement: (input) => window.tjournal.cashMovements.create(input),
  deleteCashMovement: (id) => window.tjournal.cashMovements.delete(id),
  listCashMovements: () =>
    window.tjournal.cashMovements?.list?.() ?? Promise.resolve({ ok: true as const, value: [] }),
  updateCashMovement: (input) => window.tjournal.cashMovements.update(input),
  createTrade: (input) => window.tjournal.trades.create(input),
  deleteTrade: (id) => window.tjournal.trades.delete(id),
  deleteTrades: (ids) => window.tjournal.trades.deleteMany(ids),
  getHistory: () => window.tjournal.history.getState(),
  getInstrumentProfile: (instrumentId) => window.tjournal.instrumentProfiles.get(instrumentId),
  getSettings: () => window.tjournal.settings.get(),
  getTradePreferences: () => window.tjournal.tradePreferences.get(),
  getTradeSummary: (input) => window.tjournal.analytics.summary(input),
  listInstruments: () => window.tjournal.instruments.list(),
  listTrades: () => window.tjournal.trades.list(),
  redo: () => window.tjournal.history.redo(),
  undo: () => window.tjournal.history.undo(),
  updateSettings: (input) => window.tjournal.settings.update(input),
  updateInstrumentProfile: (input) => window.tjournal.instrumentProfiles.update(input),
  updateTradePreferences: (input) => window.tjournal.tradePreferences.update(input),
  updateTrade: (input) => window.tjournal.trades.update(input),
});
