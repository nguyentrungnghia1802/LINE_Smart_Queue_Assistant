import { S3Client } from '@aws-sdk/client-s3';

import { config } from '../../config';

import { mediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { LocalMediaStorage, MockMediaStorage } from './media-storage';
import { S3CompatibleMediaStorage } from './s3-media-storage';

function createStorage() {
  if (config.media.provider === 'mock') return new MockMediaStorage();
  if (config.media.provider === 's3') {
    const client = new S3Client({
      endpoint: config.media.s3.endpoint || undefined,
      region: config.media.s3.region,
      forcePathStyle: config.media.s3.forcePathStyle,
      credentials: {
        accessKeyId: config.media.s3.accessKeyId,
        secretAccessKey: config.media.s3.secretAccessKey,
      },
    });
    return new S3CompatibleMediaStorage(
      client,
      config.media.s3.bucket,
      config.media.s3.publicBaseUrl
    );
  }
  return new LocalMediaStorage(config.media.localDir, config.media.publicBaseUrl);
}

export const mediaService = new MediaService(
  createStorage(),
  mediaRepository,
  config.media.maxOriginalBytes
);
