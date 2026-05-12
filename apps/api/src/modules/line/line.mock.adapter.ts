/**
 * In-memory mock LINE Messaging API adapter.
 *
 * Use in Jest tests by passing an instance directly to service functions
 * (which accept the adapter as an optional parameter):
 *
 *   const adapter = new MockLineAdapter();
 *   await handleWebhookEvents(body, adapter);
 *   expect(adapter.replyCalls[0].messages[0].text).toContain('Welcome');
 *
 * Alternatively, for module-level mocking:
 *   jest.mock('../../line.messaging', () => ({
 *     lineMessagingAdapter: new MockLineAdapter(),
 *   }));
 *
 * Call `adapter.reset()` in `beforeEach` to clear state between tests.
 */

import type { ILineMessagingAdapter, LineMessage } from './line.adapter';

export interface MockPushCall {
  to: string;
  messages: LineMessage[];
}

export interface MockReplyCall {
  replyToken: string;
  messages: LineMessage[];
}

export class MockLineAdapter implements ILineMessagingAdapter {
  readonly pushCalls: MockPushCall[] = [];
  readonly replyCalls: MockReplyCall[] = [];

  async pushMessage(to: string, messages: LineMessage[]): Promise<void> {
    this.pushCalls.push({ to, messages });
  }

  async replyMessage(replyToken: string, messages: LineMessage[]): Promise<void> {
    this.replyCalls.push({ replyToken, messages });
  }

  /** Clear recorded calls — call in `beforeEach`. */
  reset(): void {
    this.pushCalls.length = 0;
    this.replyCalls.length = 0;
  }
}
