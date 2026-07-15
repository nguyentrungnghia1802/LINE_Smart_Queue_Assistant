import {
  buildTicketDeepLink,
  buildTicketNotification,
  ticketBookingCreatedMessage,
  ticketCalledMessage,
  ticketCompletedMessage,
  TicketNotificationEventType,
} from '../line-notification.templates';

describe('line-notification.templates', () => {
  it('builds LIFF ticket deep links with liff.state', () => {
    expect(buildTicketDeepLink('entry-123', { liffId: '1234567890-AbCdEfGh' })).toBe(
      'https://liff.line.me/1234567890-AbCdEfGh?liff.state=%2Fliff%2Ftickets%2Fentry-123'
    );
  });

  it('falls back to web origin when LIFF ID is not configured', () => {
    expect(buildTicketDeepLink('entry-123', { webOrigin: 'https://queue.example.com/' })).toBe(
      'https://queue.example.com/liff/tickets/entry-123'
    );
  });

  it('appends ticket links to lifecycle messages', () => {
    const message = ticketCalledMessage('A019', {
      ticketUrl: 'https://queue.example.com/liff/tickets/entry-123',
    });
    expect(message).toContain('A019');
    expect(message).toContain('受付状況: https://queue.example.com/liff/tickets/entry-123');
  });

  it('keeps messages unchanged when no ticket link is provided', () => {
    expect(ticketCompletedMessage('A019')).toBe(
      '受付番号 A019 の対応が完了しました。ご利用ありがとうございました。'
    );
  });

  it('builds a reusable Flex Message payload for ticket notifications', () => {
    const notification = buildTicketNotification({
      eventType: 'booking_created',
      ticketCode: 'A019',
      ticketUrl: 'https://queue.example.com/liff/tickets/entry-123',
      aheadCount: 2,
      estimatedWaitSeconds: 900,
    });

    expect(notification.flexMessage.type).toBe('flex');
    expect(notification.flexMessage.altText).toContain('A019');
    expect(notification.textMessage).toContain('受付が完了しました');
    expect(notification.textMessage).toContain('前の人数: 2名');
    expect(notification.textMessage).toContain('待ち時間目安: 約15分');
    expect(notification.flexMessage.contents).toMatchObject({
      type: 'bubble',
      footer: {
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '受付状況を開く',
              uri: 'https://queue.example.com/liff/tickets/entry-123',
            },
          },
        ],
      },
    });
  });

  it.each<[TicketNotificationEventType, string]>([
    ['booking_created', '受付が完了しました'],
    ['eta_warning', 'まもなく順番です'],
    ['called', '順番になりました'],
    ['serving', '対応を開始しました'],
    ['completed', '対応が完了しました'],
    ['cancelled', '受付をキャンセルしました'],
    ['no_show', '不在として処理されました'],
  ])('centralizes Japanese copy for %s notifications', (eventType, headline) => {
    const notification = buildTicketNotification({
      eventType,
      ticketCode: 'A019',
      ticketUrl: 'https://queue.example.com/liff/tickets/entry-123',
      aheadCount: 1,
      estimatedWaitSeconds: 300,
    });

    expect(notification.textMessage).toContain('LINE Smart Queue Assistant');
    expect(notification.textMessage).toContain(headline);
    expect(notification.textMessage).toContain('受付番号: A019');
    expect(notification.flexMessage.altText).toContain('A019');
  });

  it('provides a text fallback for booking-created notifications', () => {
    const text = ticketBookingCreatedMessage('A019', {
      ticketUrl: 'https://queue.example.com/liff/tickets/entry-123',
      aheadCount: 0,
      estimatedWaitSeconds: 0,
    });

    expect(text).toContain('受付が完了しました');
    expect(text).toContain('前の人数: なし');
    expect(text).toContain('受付状況: https://queue.example.com/liff/tickets/entry-123');
  });
});
