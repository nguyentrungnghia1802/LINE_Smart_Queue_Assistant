import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { LocalMediaStorage, MockMediaStorage } from '../media-storage';

const input = {
  key: 'product_image/2026-08-09/item.webp',
  body: Buffer.from('image'),
  contentType: 'image/webp',
};

describe('media storage providers', () => {
  it('persists and deletes local media through the adapter', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'sqa-media-'));
    const storage = new LocalMediaStorage(root, '/media');

    try {
      await expect(storage.put(input)).resolves.toEqual({
        key: input.key,
        publicUrl: '/media/product_image/2026-08-09/item.webp',
      });
      await expect(readFile(path.join(root, input.key))).resolves.toEqual(input.body);

      await storage.delete(input.key);
      await expect(storage.delete(input.key)).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps mock media isolated and supports repeated delete', async () => {
    const storage = new MockMediaStorage();

    await storage.put(input);
    expect(storage.objects.get(input.key)).toEqual(input);

    await storage.delete(input.key);
    await expect(storage.delete(input.key)).resolves.toBeUndefined();
    expect(storage.objects.has(input.key)).toBe(false);
  });
});
