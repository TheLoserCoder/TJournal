import { describe, expect, it, vi } from 'vitest';

import type { AccountInstrumentDefaults } from '@tjournal/account';
import type {
  CreateInstrumentInput,
  Instrument,
  UpdateInstrumentInput,
} from '@tjournal/instrument';

import { DATA_RESOURCES } from '../../../shared/desktop-api';
import { UndoRedoHistory } from '../../history/undo-redo-history';
import { InstrumentCommands } from './instrument-commands';

const makeInstrument = (overrides: Partial<Instrument> = {}): Instrument => ({
  archivedAt: null,
  calculationProfile: {
    instrumentId: 'instrument-1',
    tickSize: '0.25',
    tickValueUsdPerLot: '12.5',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  category: 'index',
  createdAt: '2026-01-01T00:00:00.000Z',
  id: 'instrument-1',
  source: 'custom',
  symbol: 'ES',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const makeDefaults = (): readonly AccountInstrumentDefaults[] => [
  {
    accountId: 'account-1',
    commissionUsd: '1',
    instrumentId: 'instrument-1',
    spreadTicks: '2',
    tickSize: null,
    tickValueUsdPerLot: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const createHarness = () => {
  const state = { archived: false, deleted: false };
  const history = new UndoRedoHistory();
  const createCatalogInstrumentUseCase = {
    execute: vi.fn((input: CreateInstrumentInput, id = 'instrument-created'): Instrument =>
      makeInstrument({ id, symbol: input.symbol }),
    ),
  };
  const updateCatalogInstrumentUseCase = {
    execute: vi.fn((input: UpdateInstrumentInput): Instrument =>
      makeInstrument({ category: input.category, id: input.id, symbol: input.symbol }),
    ),
  };
  const getInstrumentByIdUseCase = {
    execute: vi.fn((id: string): Instrument | null =>
      id === 'instrument-1' ? makeInstrument() : null,
    ),
  };
  const deleteCatalogInstrumentUseCase = {
    execute: vi.fn((id: string): Instrument => {
      state.archived = true;
      return makeInstrument({ id });
    }),
  };
  const restoreCatalogInstrumentUseCase = {
    execute: vi.fn((id: string): Instrument => makeInstrument({ id, archivedAt: null })),
  };
  const archiveInstrumentUseCase = {
    execute: vi.fn((id: string): Instrument =>
      makeInstrument({ archivedAt: '2026-02-01T00:00:00.000Z', id }),
    ),
  };
  const listCatalogInstrumentsUseCase = {
    execute: vi.fn(() => {
      if (state.deleted) return [];
      return [makeInstrument({ archivedAt: state.archived ? '2026-02-01T00:00:00.000Z' : null })];
    }),
  };
  const listInstrumentDefaultsUseCase = {
    execute: vi.fn((_instrumentId: string) => makeDefaults()),
  };
  const restoreInstrumentDefaultsUseCase = { execute: vi.fn() };
  const commands = new InstrumentCommands(
    history,
    createCatalogInstrumentUseCase,
    updateCatalogInstrumentUseCase,
    getInstrumentByIdUseCase,
    deleteCatalogInstrumentUseCase,
    restoreCatalogInstrumentUseCase,
    archiveInstrumentUseCase,
    listCatalogInstrumentsUseCase,
    listInstrumentDefaultsUseCase,
    restoreInstrumentDefaultsUseCase,
  );
  return {
    archiveInstrumentUseCase,
    commands,
    createCatalogInstrumentUseCase,
    deleteCatalogInstrumentUseCase,
    getInstrumentByIdUseCase,
    history,
    listInstrumentDefaultsUseCase,
    restoreCatalogInstrumentUseCase,
    restoreInstrumentDefaultsUseCase,
    state,
    updateCatalogInstrumentUseCase,
  };
};

describe('InstrumentCommands', () => {
  it('returns the created instrument and undoes it by deleting the same id', () => {
    const { commands, createCatalogInstrumentUseCase, deleteCatalogInstrumentUseCase, history } =
      createHarness();

    const outcome = commands.create({ category: 'index', symbol: 'ES' });

    expect(outcome.value.id).toBe('instrument-created');
    expect(outcome.changedResources).toEqual([
      DATA_RESOURCES.history,
      DATA_RESOURCES.instruments,
      DATA_RESOURCES.instrumentProfiles,
    ]);
    expect(createCatalogInstrumentUseCase.execute).toHaveBeenCalledWith(
      { category: 'index', symbol: 'ES' },
      undefined,
    );

    history.undo();
    expect(deleteCatalogInstrumentUseCase.execute).toHaveBeenCalledWith('instrument-created');
  });

  it('restores the exact symbol, category and profile when an update is undone', () => {
    const { commands, history, updateCatalogInstrumentUseCase } = createHarness();
    const input: UpdateInstrumentInput = {
      category: 'equity',
      calculationProfile: { tickSize: '0.5', tickValueUsdPerLot: '25' },
      id: 'instrument-1',
      symbol: 'NQ',
    };

    commands.update(input);
    expect(updateCatalogInstrumentUseCase.execute).toHaveBeenCalledWith(input);

    history.undo();
    expect(updateCatalogInstrumentUseCase.execute).toHaveBeenCalledWith({
      category: 'index',
      calculationProfile: { tickSize: '0.25', tickValueUsdPerLot: '12.5' },
      id: 'instrument-1',
      symbol: 'ES',
    });
  });

  it('unarchives an archived instrument on undo instead of recreating it', () => {
    const { commands, history, restoreCatalogInstrumentUseCase, restoreInstrumentDefaultsUseCase } =
      createHarness();

    commands.delete('instrument-1');
    history.undo();

    expect(restoreCatalogInstrumentUseCase.execute).toHaveBeenCalledWith('instrument-1');
    expect(restoreInstrumentDefaultsUseCase.execute).not.toHaveBeenCalled();
  });

  it('recreates a physically deleted instrument and its account defaults on undo', () => {
    const {
      commands,
      createCatalogInstrumentUseCase,
      history,
      restoreCatalogInstrumentUseCase,
      restoreInstrumentDefaultsUseCase,
      state,
    } = createHarness();
    state.deleted = true;

    commands.delete('instrument-1');
    history.undo();

    expect(restoreCatalogInstrumentUseCase.execute).not.toHaveBeenCalled();
    expect(createCatalogInstrumentUseCase.execute).toHaveBeenCalledWith(
      {
        category: 'index',
        calculationProfile: { tickSize: '0.25', tickValueUsdPerLot: '12.5' },
        symbol: 'ES',
      },
      'instrument-1',
    );
    expect(restoreInstrumentDefaultsUseCase.execute).toHaveBeenCalledWith(makeDefaults());
  });

  it('archives a restored instrument on undo', () => {
    const { archiveInstrumentUseCase, commands, history, restoreCatalogInstrumentUseCase } =
      createHarness();

    commands.restore('instrument-1');
    expect(restoreCatalogInstrumentUseCase.execute).toHaveBeenCalledWith('instrument-1');

    history.undo();
    expect(archiveInstrumentUseCase.execute).toHaveBeenCalledWith('instrument-1');
  });

  it('refuses to delete an unknown instrument without touching history', () => {
    const { commands, deleteCatalogInstrumentUseCase, history } = createHarness();

    expect(() => commands.delete('missing')).toThrow('Instrument not found.');
    expect(deleteCatalogInstrumentUseCase.execute).not.toHaveBeenCalled();
    expect(history.getState().canUndo).toBe(false);
  });
});
