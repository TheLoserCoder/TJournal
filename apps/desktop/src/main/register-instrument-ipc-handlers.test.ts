import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ipcMainMock } = vi.hoisted(() => ({ ipcMainMock: { handle: vi.fn() } }));
vi.mock('electron', () => ({ ipcMain: ipcMainMock }));

import type {
  InstrumentCalculationProfileDto,
  InstrumentDto,
  IpcResult,
} from '../shared/desktop-api';
import { DATA_RESOURCES } from '../shared/desktop-api';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { registerInstrumentIpcHandlers } from './register-instrument-ipc-handlers';
import { createIpcTestHarness } from './testing/ipc-test-harness';

const INSTRUMENT: InstrumentDto = {
  archivedAt: null,
  calculationProfile: null,
  category: 'index',
  createdAt: '2026-01-01T00:00:00.000Z',
  id: 'instrument-1',
  source: 'custom',
  symbol: 'ES',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const PROFILE: InstrumentCalculationProfileDto = {
  instrumentId: INSTRUMENT.id,
  tickSize: '0.25',
  tickValueUsdPerLot: '12.5',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const createDependencies = () => ({
  commands: {
    create: vi.fn(() => ({
      changedResources: [
        DATA_RESOURCES.history,
        DATA_RESOURCES.instruments,
        DATA_RESOURCES.instrumentProfiles,
      ],
      value: INSTRUMENT,
    })),
    delete: vi.fn(() => ({
      changedResources: [
        DATA_RESOURCES.history,
        DATA_RESOURCES.instruments,
        DATA_RESOURCES.instrumentProfiles,
      ],
      value: INSTRUMENT,
    })),
    restore: vi.fn(() => ({
      changedResources: [DATA_RESOURCES.history, DATA_RESOURCES.instruments],
      value: INSTRUMENT,
    })),
    update: vi.fn(() => ({
      changedResources: [
        DATA_RESOURCES.history,
        DATA_RESOURCES.instruments,
        DATA_RESOURCES.instrumentProfiles,
      ],
      value: INSTRUMENT,
    })),
  },
  getInstrumentProfileUseCase: { execute: vi.fn(() => PROFILE) },
  listInstrumentsUseCase: { execute: vi.fn(() => [INSTRUMENT]) },
  saveInstrumentProfileUseCase: { execute: vi.fn(() => PROFILE) },
});

describe('registerInstrumentIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers exactly the documented instrument channels', () => {
    const harness = createIpcTestHarness();
    registerInstrumentIpcHandlers(createDependencies(), harness.context);

    expect([...harness.registeredChannels()].sort()).toEqual(
      [
        IPC_CHANNELS.instrumentsCreate,
        IPC_CHANNELS.instrumentsDelete,
        IPC_CHANNELS.instrumentsList,
        IPC_CHANNELS.instrumentsRestore,
        IPC_CHANNELS.instrumentsUpdate,
        IPC_CHANNELS.instrumentProfilesGet,
        IPC_CHANNELS.instrumentProfilesUpdate,
      ].sort(),
    );
  });

  it('delegates a parsed instrument to the command and publishes its resources', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerInstrumentIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<InstrumentDto>>(IPC_CHANNELS.instrumentsCreate, {
      category: 'index',
      symbol: 'ES',
    });

    expect(dependencies.commands.create).toHaveBeenCalledWith({
      category: 'index',
      symbol: 'ES',
    });
    expect(result).toEqual({ ok: true, value: INSTRUMENT });
    expect(harness.capture).toHaveBeenCalledWith([
      DATA_RESOURCES.history,
      DATA_RESOURCES.instruments,
      DATA_RESOURCES.instrumentProfiles,
    ]);
  });

  it('never invokes a command for an invalid payload', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerInstrumentIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<InstrumentDto>>(IPC_CHANNELS.instrumentsCreate, {
      category: 'unknown',
      symbol: 'ES',
    });

    expect(result.ok).toBe(false);
    expect(dependencies.commands.create).not.toHaveBeenCalled();
    expect(harness.capture).not.toHaveBeenCalled();
  });

  it('lists instruments without publishing changes', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerInstrumentIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<readonly InstrumentDto[]>>(
      IPC_CHANNELS.instrumentsList,
    );

    expect(result).toEqual({ ok: true, value: [INSTRUMENT] });
    expect(harness.capture).not.toHaveBeenCalled();
  });

  it('validates and publishes instrument profile updates through the instrument owner', async () => {
    const harness = createIpcTestHarness();
    const dependencies = createDependencies();
    registerInstrumentIpcHandlers(dependencies, harness.context);

    const result = await harness.invoke<IpcResult<InstrumentCalculationProfileDto>>(
      IPC_CHANNELS.instrumentProfilesUpdate,
      PROFILE,
    );

    expect(result).toEqual({ ok: true, value: PROFILE });
    expect(dependencies.saveInstrumentProfileUseCase.execute).toHaveBeenCalledWith(PROFILE);
    expect(harness.capture).toHaveBeenCalledWith([DATA_RESOURCES.instrumentProfiles]);
  });
});
