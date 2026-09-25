import type { DataResource } from '../../shared/desktop-api';

/**
 * Result of one application command: the value the IPC layer returns and the
 * data groups the renderer must invalidate after the mutation committed.
 */
export interface CommandOutcome<T> {
  readonly changedResources: readonly DataResource[];
  readonly value: T;
}
