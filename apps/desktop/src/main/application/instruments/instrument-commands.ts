import type {
  ArchiveInstrumentUseCase,
  CreateInstrumentInput,
  CreateInstrumentUseCase,
  DeleteInstrumentUseCase,
  GetInstrumentByIdUseCase,
  Instrument,
  ListInstrumentsUseCase,
  RestoreInstrumentUseCase,
  UpdateInstrumentInput,
  UpdateInstrumentUseCase,
} from '@tjournal/instrument';
import type {
  ListInstrumentDefaultsUseCase,
  RestoreInstrumentDefaultsUseCase,
} from '@tjournal/account';

import { DATA_RESOURCES } from '../../../shared/desktop-api';
import type { CommandHistory } from '../command-history';
import type { CommandOutcome } from '../command-outcome';

const INSTRUMENT_RESOURCES = [
  DATA_RESOURCES.history,
  DATA_RESOURCES.instruments,
  DATA_RESOURCES.instrumentProfiles,
] as const;
const INSTRUMENT_RESTORE_RESOURCES = [DATA_RESOURCES.history, DATA_RESOURCES.instruments] as const;

const toProfileInput = (instrument: Instrument): CreateInstrumentInput['calculationProfile'] =>
  instrument.calculationProfile === null
    ? null
    : {
        tickSize: instrument.calculationProfile.tickSize,
        tickValueUsdPerLot: instrument.calculationProfile.tickValueUsdPerLot,
      };

/**
 * Undo/Redo orchestration for the instrument catalogue. A physically deleted
 * instrument is recreated with its original id and its account defaults are
 * re-applied; an archived instrument is only unarchived.
 */
export class InstrumentCommands {
  public constructor(
    private readonly history: CommandHistory,
    private readonly createCatalogInstrumentUseCase: Pick<CreateInstrumentUseCase, 'execute'>,
    private readonly updateCatalogInstrumentUseCase: Pick<UpdateInstrumentUseCase, 'execute'>,
    private readonly getInstrumentByIdUseCase: Pick<GetInstrumentByIdUseCase, 'execute'>,
    private readonly deleteCatalogInstrumentUseCase: Pick<DeleteInstrumentUseCase, 'execute'>,
    private readonly restoreCatalogInstrumentUseCase: Pick<RestoreInstrumentUseCase, 'execute'>,
    private readonly archiveInstrumentUseCase: Pick<ArchiveInstrumentUseCase, 'execute'>,
    private readonly listCatalogInstrumentsUseCase: Pick<ListInstrumentsUseCase, 'execute'>,
    private readonly listInstrumentDefaultsUseCase: Pick<ListInstrumentDefaultsUseCase, 'execute'>,
    private readonly restoreInstrumentDefaultsUseCase: Pick<
      RestoreInstrumentDefaultsUseCase,
      'execute'
    >,
  ) {}

  public create(input: CreateInstrumentInput): CommandOutcome<Instrument> {
    let created: Instrument | null = null;
    const value = this.history.execute({
      execute: () => {
        created = this.createCatalogInstrumentUseCase.execute(input, created?.id);
        return created;
      },
      label: 'instrument.create',
      undo: () => {
        if (created !== null) this.deleteCatalogInstrumentUseCase.execute(created.id);
      },
    });
    return { changedResources: INSTRUMENT_RESOURCES, value };
  }

  public update(input: UpdateInstrumentInput): CommandOutcome<Instrument> {
    const previous = this.getInstrumentByIdUseCase.execute(input.id);
    if (previous === null) throw new Error('Instrument not found.');
    const value = this.history.execute({
      execute: () => this.updateCatalogInstrumentUseCase.execute(input),
      label: 'instrument.update',
      undo: () => {
        this.updateCatalogInstrumentUseCase.execute({
          category: previous.category,
          calculationProfile: toProfileInput(previous),
          id: previous.id,
          symbol: previous.symbol,
        });
      },
    });
    return { changedResources: INSTRUMENT_RESOURCES, value };
  }

  public delete(id: string): CommandOutcome<Instrument> {
    const previous = this.getInstrumentByIdUseCase.execute(id);
    if (previous === null) throw new Error('Instrument not found.');
    const previousDefaults = this.listInstrumentDefaultsUseCase.execute(id);
    let wasArchived = false;
    const value = this.history.execute({
      execute: () => {
        const deleted = this.deleteCatalogInstrumentUseCase.execute(id);
        wasArchived = this.listCatalogInstrumentsUseCase.execute().some((item) => item.id === id);
        return deleted;
      },
      label: 'instrument.delete',
      undo: () => {
        if (wasArchived) {
          this.restoreCatalogInstrumentUseCase.execute(id);
          return;
        }
        this.createCatalogInstrumentUseCase.execute(
          {
            category: previous.category,
            calculationProfile: toProfileInput(previous),
            symbol: previous.symbol,
          },
          previous.id,
        );
        this.restoreInstrumentDefaultsUseCase.execute(previousDefaults);
      },
    });
    return { changedResources: INSTRUMENT_RESOURCES, value };
  }

  public restore(id: string): CommandOutcome<Instrument> {
    const value = this.history.execute({
      execute: () => this.restoreCatalogInstrumentUseCase.execute(id),
      label: 'instrument.restore',
      undo: () => {
        this.archiveInstrumentUseCase.execute(id);
      },
    });
    return { changedResources: INSTRUMENT_RESTORE_RESOURCES, value };
  }
}
