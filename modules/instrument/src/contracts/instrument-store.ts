import type {
  CreateInstrumentInput,
  Instrument,
  InstrumentCalculationProfile,
  UpdateInstrumentInput,
} from '../domain/instrument';

export interface InstrumentStore {
  archiveInstrument(id: string): Instrument;
  createInstrument(input: CreateInstrumentInput & { readonly id: string }): Instrument;
  deleteInstrument(id: string): Instrument;
  getInstrumentProfile(id: string): InstrumentCalculationProfile | null;
  getInstrumentById(id: string): Instrument | null;
  listInstruments(): readonly Instrument[];
  restoreArchivedInstrument(id: string): Instrument;
  saveInstrumentProfile(profile: InstrumentCalculationProfile): InstrumentCalculationProfile;
  updateInstrument(input: UpdateInstrumentInput): Instrument;
}
