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

import { logger } from '../../utils/logger';

import type { ILineMessagingAdapter, LineMessage } from './line.adapter';

const LINE_API_BASE = 'https://api.line.me/v2/bot';

export class LineSdkAdapter implements ILineMessagingAdapter {
  // Authorization header value — never logged (only the status code is).
  private readonly authHeader: string;

  constructor(channelAccessToken: string) {
    this.authHeader = `Bearer ${channelAccessToken}`;
  }

  async pushMessage(to: string, messages: LineMessage[]): Promise<void> {
    await this.post('/message/push', { to, messages });
  }

  async replyMessage(replyToken: string, messages: LineMessage[]): Promise<void> {
    await this.post('/message/reply', { replyToken, messages });
  }

  private async post(path: string, body: unknown): Promise<void> {
    const res = await fetch(`${LINE_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Authorization header intentionally NOT spread into a logged object.
        Authorization: this.authHeader,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Read the body for diagnostics but never log the auth token.
      const detail = await res.text().catch(() => '(unreadable)');
      logger.error({ statusCode: res.status, path, detail }, 'LINE Messaging API request failed');
      throw new Error(`LINE API returned ${res.status} for ${path}`);
    }
  }
}
