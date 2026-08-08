import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { logger } from '../../utils/logger';

type WorkerHealthStatus = 'ready' | 'degraded';

export class WorkerHeartbeat {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly filePath: string,
    private readonly intervalMs: number,
    private readonly statusProvider: () => WorkerHealthStatus = () => 'ready'
  ) {}

  async start(): Promise<void> {
    if (this.timer) return;
    await this.write();
    this.timer = setInterval(() => {
      void this.write().catch((error: unknown) => {
        logger.error(
          { errorType: error instanceof Error ? error.name : 'UnknownError' },
          'Worker heartbeat update failed'
        );
      });
    }, this.intervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await rm(this.filePath, { force: true });
  }

  private async write(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(
      this.filePath,
      JSON.stringify({ status: this.statusProvider(), updatedAt: new Date().toISOString() }),
      'utf8'
    );
  }
}
