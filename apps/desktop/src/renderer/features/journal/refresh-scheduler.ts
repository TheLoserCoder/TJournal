import type { RefreshTarget } from './refresh-resources';

/**
 * Single-flight refresh queue. Targets scheduled in the same turn coalesce
 * into one run, targets scheduled during a run are merged into the next one,
 * and a full refresh can be awaited when the caller must observe loaded data
 * (for example after activating another vault).
 */
export class RefreshScheduler {
  private readonly pending = new Set<RefreshTarget>();
  private running: Promise<void> | null = null;
  private startScheduled = false;
  private disposed = false;

  public constructor(private readonly run: (targets: readonly RefreshTarget[]) => Promise<void>) {}

  public schedule(targets: readonly RefreshTarget[]): void {
    if (this.disposed || targets.length === 0) return;
    targets.forEach((target) => this.pending.add(target));
    this.scheduleStart();
  }

  public async refreshAll(): Promise<void> {
    if (this.disposed) return;
    this.pending.add('all');
    this.start();
    await this.running;
  }

  public dispose(): void {
    this.disposed = true;
    this.pending.clear();
  }

  private scheduleStart(): void {
    if (this.disposed || this.running !== null || this.startScheduled) return;
    this.startScheduled = true;
    queueMicrotask(() => {
      this.startScheduled = false;
      this.start();
    });
  }

  private start(): void {
    if (this.disposed || this.running !== null || this.pending.size === 0) return;
    this.running = this.drain().finally(() => {
      this.running = null;
      if (!this.disposed && this.pending.size > 0) this.scheduleStart();
    });
  }

  private async drain(): Promise<void> {
    while (!this.disposed && this.pending.size > 0) {
      const targets = [...this.pending];
      this.pending.clear();
      await this.run(targets);
    }
  }
}
