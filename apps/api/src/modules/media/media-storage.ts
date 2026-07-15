import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface MediaStoragePutInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface MediaStorage {
  readonly provider: 'local' | 'mock' | 'object';
  put(input: MediaStoragePutInput): Promise<{ key: string; publicUrl: string }>;
  delete(key: string): Promise<void>;
}

function safePath(root: string, key: string) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, key);
  if (!target.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Unsafe media storage key');
  }
  return target;
}

export class LocalMediaStorage implements MediaStorage {
  readonly provider = 'local' as const;

  constructor(
    private readonly root: string,
    private readonly publicBaseUrl: string
  ) {}

  async put(input: MediaStoragePutInput) {
    const target = safePath(this.root, input.key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.body, { flag: 'wx' });
    return {
      key: input.key,
      publicUrl: `${this.publicBaseUrl.replace(/\/$/, '')}/${input.key.replace(/\\/g, '/')}`,
    };
  }

  async delete(key: string) {
    await rm(safePath(this.root, key), { force: true });
  }
}

export class MockMediaStorage implements MediaStorage {
  readonly provider = 'mock' as const;
  readonly objects = new Map<string, MediaStoragePutInput>();

  async put(input: MediaStoragePutInput) {
    this.objects.set(input.key, input);
    return { key: input.key, publicUrl: `/mock-media/${input.key}` };
  }

  async delete(key: string) {
    this.objects.delete(key);
  }
}

export interface ObjectStorageClient {
  putObject(input: MediaStoragePutInput): Promise<{ publicUrl: string }>;
  deleteObject(key: string): Promise<void>;
}

export class ObjectCompatibleMediaStorage implements MediaStorage {
  readonly provider = 'object' as const;

  constructor(private readonly client: ObjectStorageClient) {}

  async put(input: MediaStoragePutInput) {
    const result = await this.client.putObject(input);
    return { key: input.key, publicUrl: result.publicUrl };
  }

  delete(key: string) {
    return this.client.deleteObject(key);
  }
}
