import { config } from '../../config';

import { mediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { LocalMediaStorage, MockMediaStorage } from './media-storage';

const storage =
  config.media.mode === 'mock'
    ? new MockMediaStorage()
    : new LocalMediaStorage(config.media.localDir, config.media.publicBaseUrl);

export const mediaService = new MediaService(
  storage,
  mediaRepository,
  config.media.maxOriginalBytes
);
