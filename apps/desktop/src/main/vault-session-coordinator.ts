import type { CreateVaultUseCase, InspectVaultUseCase, OpenVaultUseCase } from '@tjournal/journal';
import type { Logger } from '@tjournal/platform-observability';
import { AppError } from '@tjournal/platform-errors';

import type { CommittedDataChangeDto } from '../shared/desktop-api';
import type { CommittedChangeCoordinator } from './committed-change-coordinator';
import type { UndoRedoHistory } from './history/undo-redo-history';
import type { RecentVaultPreferences } from './recent-vault-preferences';

export interface VaultSessionActivation {
  readonly change: CommittedDataChangeDto;
  readonly path: string;
}

/**
 * Activates a vault as one session transition: the candidate is validated
 * before the active session is replaced, and invalidation plus history always
 * belong to the vault that is open after the call.
 */
export class VaultSessionCoordinator {
  private opening = false;

  public constructor(
    private readonly createVaultUseCase: Pick<CreateVaultUseCase, 'execute'>,
    private readonly openVaultUseCase: Pick<OpenVaultUseCase, 'execute'>,
    private readonly inspectVaultUseCase: Pick<InspectVaultUseCase, 'execute'>,
    private readonly committedChangeCoordinator: Pick<CommittedChangeCoordinator, 'resetForVault'>,
    private readonly recentVaultPreferences: Pick<RecentVaultPreferences, 'setLastVaultPath'>,
    private readonly history: Pick<UndoRedoHistory, 'reset'>,
    private readonly logger: Logger,
  ) {}

  public create(vaultPath: string): VaultSessionActivation {
    if (this.opening) this.rejectConcurrentTransition();
    return this.activate(this.createVaultUseCase.execute(vaultPath).path);
  }

  public async open(vaultPath: string): Promise<VaultSessionActivation> {
    if (this.opening) this.rejectConcurrentTransition();
    this.opening = true;
    try {
      // Fail on an invalid candidate before the active vault is replaced.
      this.inspectVaultUseCase.execute(vaultPath);
      return this.activate((await this.openVaultUseCase.execute(vaultPath)).path);
    } finally {
      this.opening = false;
    }
  }

  private rejectConcurrentTransition(): never {
    throw new AppError({
      code: 'vault-not-accessible',
      message: 'Another vault transition is in progress.',
      retryable: true,
    });
  }

  private activate(vaultPath: string): VaultSessionActivation {
    const change = this.committedChangeCoordinator.resetForVault();
    this.history.reset();
    try {
      this.recentVaultPreferences.setLastVaultPath(vaultPath);
    } catch {
      // The database session is already active. A non-critical recent-path
      // preference must not turn that successful transition into a failed IPC.
      this.logger.warn('vault.recent-path-save-failed');
    }
    return { change, path: vaultPath };
  }
}
