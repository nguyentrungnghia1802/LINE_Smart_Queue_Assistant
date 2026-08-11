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

  it('publishes the same sanitized heartbeat used by the container health file', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'sqa-worker-'));
    const filePath = path.join(directory, 'health.json');
    const published: Array<{ status: string; updatedAt: string }> = [];
    const heartbeat = new WorkerHeartbeat(
      filePath,
      60_000,
      () => 'ready',
      async (payload) => {
        published.push(payload);
      }
    );

    try {
      await heartbeat.start();
      expect(published).toHaveLength(1);
      expect(published[0]).toMatchObject({ status: 'ready' });
      expect(Number.isFinite(Date.parse(published[0]?.updatedAt ?? ''))).toBe(true);
    } finally {
      await heartbeat.stop();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('keeps the container heartbeat healthy when shared heartbeat publishing fails', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'sqa-worker-'));
    const filePath = path.join(directory, 'health.json');
    const heartbeat = new WorkerHeartbeat(
      filePath,
      60_000,
      () => 'ready',
      async () => {
        throw new Error('Redis unavailable');
      }
    );

    try {
      await expect(heartbeat.start()).resolves.toBeUndefined();
      await expect(readFile(filePath, 'utf8')).resolves.toContain('"status":"ready"');
    } finally {
      await heartbeat.stop();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
