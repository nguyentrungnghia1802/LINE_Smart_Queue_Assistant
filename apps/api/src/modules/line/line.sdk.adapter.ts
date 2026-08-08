/**
 * Real LINE Messaging API adapter.
 *
 * Uses the global `fetch` (available since Node 18) to call the LINE Messaging
 * API directly. Keeps the dependency surface minimal — no @line/bot-sdk —
 * while keeping the HTTP behaviour fully transparent and auditable.
 *
 * This is the ONLY file in the project that talks to api.line.me.
 * All other files interact with the ILineMessagingAdapter interface.
 */

import { config } from '../../config';
import { logger } from '../../utils/logger';

import type { ILineMessagingAdapter, LineMessage, LineMessageOptions } from './line.adapter';

const LINE_API_BASE = 'https://api.line.me/v2/bot';

export class LineProviderError extends Error {
  readonly statusCode: number | null;
  readonly retryAfterMs: number | null;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { statusCode?: number; retryAfterMs?: number; retryable: boolean; cause?: unknown }
  ) {
    super(message, { cause: options.cause });
    this.name = 'LineProviderError';
    this.statusCode = options.statusCode ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.retryable = options.retryable;
  }
}

function retryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

export class LineSdkAdapter implements ILineMessagingAdapter {
  // Authorization header value — never logged (only the status code is).
  private readonly authHeader: string;

  constructor(channelAccessToken: string) {
    this.authHeader = `Bearer ${channelAccessToken}`;
  }

  async pushMessage(
    to: string,
    messages: LineMessage[],
    options: LineMessageOptions = {}
  ): Promise<void> {
    await this.post(
      '/message/push',
      {
        to,
        messages,
        notificationDisabled: options.notificationDisabled ?? false,
      },
      options.retryKey ? { 'X-Line-Retry-Key': options.retryKey } : undefined
    );
  }

  async replyMessage(
    replyToken: string,
    messages: LineMessage[],
    options: LineMessageOptions = {}
  ): Promise<void> {
    await this.post('/message/reply', {
      replyToken,
      messages,
      notificationDisabled: options.notificationDisabled ?? false,
    });
  }

  private async post(
    path: string,
    body: unknown,
    additionalHeaders?: Record<string, string>
  ): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${LINE_API_BASE}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Authorization header intentionally NOT spread into a logged object.
          Authorization: this.authHeader,
          ...additionalHeaders,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.line.messagingRequestTimeoutMs),
      });
    } catch (error) {
      throw new LineProviderError('LINE Messaging API request timed out or was unreachable', {
        retryable: true,
        cause: error,
      });
    }

    if (!res.ok) {
      logger.error({ statusCode: res.status, path }, 'LINE Messaging API request failed');
      throw new LineProviderError(`LINE API returned ${res.status} for ${path}`, {
        statusCode: res.status,
        retryAfterMs: retryAfterMs(res.headers.get('retry-after')),
        retryable: res.status === 429 || res.status >= 500,
      });
    }
  }
}
