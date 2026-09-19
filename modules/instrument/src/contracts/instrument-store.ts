import type {
  CreateInstrumentInput,
  Instrument,
  UpdateInstrumentInput,
} from '../domain/instrument';

export interface InstrumentStore {
  archiveInstrument(id: string): Instrument;
  createInstrument(input: CreateInstrumentInput & { readonly id: string }): Instrument;
  deleteInstrument(id: string): Instrument;
  listInstruments(): readonly Instrument[];
  restoreArchivedInstrument(id: string): Instrument;
  updateInstrument(input: UpdateInstrumentInput): Instrument;
}
