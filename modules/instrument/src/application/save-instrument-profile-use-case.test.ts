import { describe, expect, it, vi } from 'vitest';

import { SaveInstrumentProfileUseCase } from './save-instrument-profile-use-case';

describe('SaveInstrumentProfileUseCase', () => {
  it('normalizes exact decimal strings before delegating to the instrument store', () => {
    const saveInstrumentProfile = vi.fn((profile) => profile);
    const useCase = new SaveInstrumentProfileUseCase({ saveInstrumentProfile });

    const result = useCase.execute({
      instrumentId: 'instrument-1',
      tickSize: '000.2500',
      tickValueUsdPerLot: '012.500',
      updatedAt: '2026-09-22T00:00:00.000Z',
    });

    expect(result).toEqual({
      instrumentId: 'instrument-1',
      tickSize: '0.25',
      tickValueUsdPerLot: '12.5',
      updatedAt: '2026-09-22T00:00:00.000Z',
    });
    expect(saveInstrumentProfile).toHaveBeenCalledWith(result);
  });
});
