import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

import type { MediaStorage, MediaStoragePutInput } from './media-storage';

export interface S3ObjectClient {
  send(command: PutObjectCommand | DeleteObjectCommand): Promise<unknown>;
}

function publicUrl(baseUrl: string, key: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

function safeKey(key: string): string {
  if (!key || key.startsWith('/') || key.includes('\\')) {
    throw new Error('Unsafe media storage key');
  }
  const segments = key.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('Unsafe media storage key');
  }
  return key;
}

/**
 * Stores validated media through AWS S3, Cloudflare R2, or another S3 API.
 * The adapter deliberately receives only server-side configuration and never
 * exposes a presigned URL or credential to the browser.
 */
export class S3CompatibleMediaStorage implements MediaStorage {
  readonly provider = 'object' as const;

  constructor(
    private readonly client: S3ObjectClient,
    private readonly bucket: string,
    private readonly publicBaseUrl: string
  ) {}

  async put(input: MediaStoragePutInput) {
    const key = safeKey(input.key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
        IfNoneMatch: '*',
      })
    );
    return { key, publicUrl: publicUrl(this.publicBaseUrl, key) };
  }

  async delete(key: string) {
    // S3 DeleteObject is idempotent for missing keys, which makes retrying a
    // delete safe when a provider timeout leaves the outcome uncertain.
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: safeKey(key) }));
  }
}
