import type { RendererGateway } from './renderer-gateway';

export const createElectronRendererGateway = (): RendererGateway => ({
  createInstrument: (input) => window.tjournal.instruments.create(input),
  createTrade: (input) => window.tjournal.trades.create(input),
  deleteTrade: (id) => window.tjournal.trades.delete(id),
  getHistory: () => window.tjournal.history.getState(),
  getSettings: () => window.tjournal.settings.get(),
  listInstruments: () => window.tjournal.instruments.list(),
  listTrades: () => window.tjournal.trades.list(),
  redo: () => window.tjournal.history.redo(),
  undo: () => window.tjournal.history.undo(),
  updateSettings: (input) => window.tjournal.settings.update(input),
  updateTrade: (input) => window.tjournal.trades.update(input),
});
