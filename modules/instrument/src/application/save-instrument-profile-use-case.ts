import type { InstrumentStore } from '../contracts/instrument-store';
import {
  normalizeCalculationProfile,
  type InstrumentCalculationProfile,
} from '../domain/instrument';

export class SaveInstrumentProfileUseCase {
  public constructor(
    private readonly instrumentStore: Pick<InstrumentStore, 'saveInstrumentProfile'>,
  ) {}

  public execute(profile: InstrumentCalculationProfile): InstrumentCalculationProfile {
    const normalized = normalizeCalculationProfile({
      tickSize: profile.tickSize,
      tickValueUsdPerLot: profile.tickValueUsdPerLot,
    });
    if (normalized === null || normalized === undefined)
      throw new Error('Instrument calculation profile is required.');
    return this.instrumentStore.saveInstrumentProfile({ ...profile, ...normalized });
  }
}
