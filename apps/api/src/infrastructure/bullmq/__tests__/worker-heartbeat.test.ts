import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { WorkerHeartbeat } from '../worker-heartbeat';

describe('WorkerHeartbeat', () => {
  it('writes a safe readiness file and removes it during shutdown', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'sqa-worker-'));
    const filePath = path.join(directory, 'health.json');
    const heartbeat = new WorkerHeartbeat(filePath, 60_000);

    try {
      await heartbeat.start();
      await expect(readFile(filePath, 'utf8')).resolves.toContain('"status":"ready"');

      await heartbeat.stop();
      await expect(access(filePath)).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('reports a degraded runtime without exposing configuration', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'sqa-worker-'));
    const filePath = path.join(directory, 'health.json');
    const heartbeat = new WorkerHeartbeat(filePath, 60_000, () => 'degraded');

    try {
      await heartbeat.start();
      const payload = JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;

      expect(payload).toMatchObject({ status: 'degraded' });
      expect(Object.keys(payload).sort()).toEqual(['status', 'updatedAt']);
    } finally {
      await heartbeat.stop();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
