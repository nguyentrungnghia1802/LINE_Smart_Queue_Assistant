/**
 * LINE Messaging API adapter factory and singleton.
 *
 * Selection logic (evaluated once at startup):
 *   • NODE_ENV=test                    → MockLineAdapter (no HTTP, safe in CI)
 *   • LINE_CHANNEL_ACCESS_TOKEN unset  → MockLineAdapter with a startup warning
 *   • otherwise                        → LineSdkAdapter (real LINE API calls)
 *
 * Import `lineMessagingAdapter` wherever you need to send messages.
 * Never import LineSdkAdapter directly outside of this file.
 */

import { config } from '../../config';
import { logger } from '../../utils/logger';

import type { ILineMessagingAdapter } from './line.adapter';
import { MockLineAdapter } from './line.mock.adapter';
import { LineSdkAdapter } from './line.sdk.adapter';

function createAdapter(): ILineMessagingAdapter {
  if (config.nodeEnv === 'test') {
    return new MockLineAdapter();
  }

  if (!config.line.channelAccessToken) {
    logger.warn(
      'LINE_CHANNEL_ACCESS_TOKEN is not set — push messages are disabled. ' +
        'Set the variable in .env to enable real LINE notifications.'
    );
    // Return a no-op mock so the app starts cleanly instead of crashing.
    return new MockLineAdapter();
  }

  return new LineSdkAdapter(config.line.channelAccessToken);
}

export const lineMessagingAdapter: ILineMessagingAdapter = createAdapter();
