import type {
  ILineMessagingAdapter,
  LineMessage,
  LineMessageOptions,
} from '../../line/line.adapter';
import { MockLineAdapter } from '../../line/line.mock.adapter';
import { lineNotificationService } from '../line-notification.service';
import { buildTicketNotification } from '../line-notification.templates';

class FlexFailTextOkAdapter implements ILineMessagingAdapter {
  readonly pushCalls: Array<{ to: string; messages: LineMessage[]; options?: LineMessageOptions }> =
    [];

  async pushMessage(
    to: string,
    messages: LineMessage[],
    options?: LineMessageOptions
  ): Promise<void> {
    this.pushCalls.push({ to, messages, options });
    if (messages[0]?.type === 'flex') {
      throw new Error('Flex rejected');
    }
  }

  async replyMessage(): Promise<void> {
    throw new Error('not used');
  }
}

class AlwaysFailAdapter implements ILineMessagingAdapter {
  async pushMessage(): Promise<void> {
    throw new Error('LINE unavailable');
  }

  async replyMessage(): Promise<void> {
    throw new Error('LINE unavailable');
  }
}

function makeNotification() {
  return buildTicketNotification({
    eventType: 'called',
    ticketCode: 'A019',
    ticketUrl: 'https://queue.example.com/liff/tickets/entry-123',
    aheadCount: 0,
    estimatedWaitSeconds: 0,
  });
}

describe('lineNotificationService', () => {
  it('sends text fallback when a Flex Message cannot be sent', async () => {
    const adapter = new FlexFailTextOkAdapter();

    const sent = await lineNotificationService.pushTicketNotification(
      'U_test_001',
      makeNotification(),
      { entryId: 'entry-123', eventType: 'called' },
      adapter
    );

    expect(sent).toBe(true);
    expect(adapter.pushCalls).toHaveLength(2);
    expect(adapter.pushCalls[0].messages[0].type).toBe('flex');
    expect(adapter.pushCalls[1].messages[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('受付番号: A019'),
    });
  });

  it('returns false when both Flex Message and text fallback fail', async () => {
    const sent = await lineNotificationService.pushTicketNotification(
      'U_test_001',
      makeNotification(),
      { entryId: 'entry-123', eventType: 'called' },
      new AlwaysFailAdapter()
    );

    expect(sent).toBe(false);
  });

  it('uses the mock adapter without making real LINE HTTP calls', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const adapter = new MockLineAdapter();

    const sent = await lineNotificationService.pushTicketNotification(
      'U_test_001',
      makeNotification(),
      { entryId: 'entry-123', eventType: 'called' },
      adapter
    );

    expect(sent).toBe(true);
    expect(adapter.pushCalls).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
