import { config } from '../../config';
import { logger } from '../../utils/logger';

import {
  type ILineRichMenuAdapter,
  LineRichMenuSdkAdapter,
  MockLineRichMenuAdapter,
} from './rich-menu.adapter';

export function createLineRichMenuAdapter(): ILineRichMenuAdapter {
  if (config.nodeEnv === 'test') {
    return new MockLineRichMenuAdapter();
  }

  if (!config.line.channelAccessToken) {
    logger.warn('LINE_CHANNEL_ACCESS_TOKEN is not set — Rich Menu sync will use the mock adapter.');
    return new MockLineRichMenuAdapter();
  }

  return new LineRichMenuSdkAdapter(config.line.channelAccessToken);
}
