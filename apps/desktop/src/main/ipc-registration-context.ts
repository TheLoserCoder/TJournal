import type { Logger } from '@tjournal/platform-observability';

import type { CommittedDataChangeDto, DataResource } from '../shared/desktop-api';

/**
 * Mechanical IPC helpers shared by every registrar: safe result conversion,
 * committed-change capture and Electron window transport. Registrars never
 * receive the Awilix cradle.
 */
export interface IpcRegistrationContext {
  readonly logger: Logger;
  readonly publish: (change: CommittedDataChangeDto | null) => void;
  readonly capture: (resources?: readonly DataResource[]) => void;
  readonly captureApplicationChange: (resources: readonly DataResource[]) => void;
}
