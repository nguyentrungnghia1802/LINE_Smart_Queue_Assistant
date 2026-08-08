import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

import { S3CompatibleMediaStorage, type S3ObjectClient } from '../s3-media-storage';

describe('S3CompatibleMediaStorage', () => {
  function setup() {
    const client: S3ObjectClient = { send: jest.fn().mockResolvedValue({}) };
    const storage = new S3CompatibleMediaStorage(
      client,
      'smart-queue-media',
      'https://cdn.example.com/assets'
    );
    return { client, storage };
  }

  it('uploads validated content with a cache policy and stable public URL', async () => {
    const { client, storage } = setup();
    const result = await storage.put({
      key: 'product_image/2026-08-09/image.webp',
      body: Buffer.from('image'),
      contentType: 'image/webp',
    });

    expect(result).toEqual({
      key: 'product_image/2026-08-09/image.webp',
      publicUrl: 'https://cdn.example.com/assets/product_image/2026-08-09/image.webp',
    });
    expect(client.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    expect((client.send as jest.Mock).mock.calls[0][0].input).toMatchObject({
      Bucket: 'smart-queue-media',
      Key: 'product_image/2026-08-09/image.webp',
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
      IfNoneMatch: '*',
    });
  });

  it('deletes an object through the configured bucket', async () => {
    const { client, storage } = setup();

    await storage.delete('organization_logo/2026-08-09/logo.webp');

    expect(client.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    expect((client.send as jest.Mock).mock.calls[0][0].input).toEqual({
      Bucket: 'smart-queue-media',
      Key: 'organization_logo/2026-08-09/logo.webp',
    });
  });

  it('rejects a key that could escape the public URL prefix', async () => {
    const { storage } = setup();

    await expect(
      storage.put({
        key: '../outside.webp',
        body: Buffer.from('image'),
        contentType: 'image/webp',
      })
    ).rejects.toThrow('Unsafe media storage key');
  });
});
