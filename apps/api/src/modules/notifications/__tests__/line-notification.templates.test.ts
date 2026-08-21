import {
  buildTicketDeepLink,
  buildTicketNotification,
  ticketBookingCreatedMessage,
  ticketCalledMessage,
  ticketCompletedMessage,
  TicketNotificationEventType,
} from '../line-notification.templates';

describe('line-notification.templates', () => {
  it('builds LIFF ticket permanent links relative to the endpoint path', () => {
    expect(
      buildTicketDeepLink('entry-123', {
        liffId: '1234567890-AbCdEfGh',
        liffEndpointPath: '/liff',
      })
    ).toBe('https://liff.line.me/1234567890-AbCdEfGh/tickets/entry-123');
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
      size: 'kilo',
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
    ['booking_created', '#A16207'],
    ['eta_warning', '#15803D'],
    ['called', '#15803D'],
    ['serving', '#15803D'],
    ['completed', '#15803D'],
    ['cancelled', '#DC2626'],
    ['no_show', '#DC2626'],
    ['deferred', '#A16207'],
    ['location_warning', '#A16207'],
  ])('uses the semantic accent color for %s', (eventType, expectedColor) => {
    const notification = buildTicketNotification({
      eventType,
      ticketCode: 'A019',
      ticketUrl: 'https://queue.example.com/liff/tickets/entry-123',
    });

    expect(
      (notification.flexMessage.contents.header as { backgroundColor?: string } | undefined)
        ?.backgroundColor
    ).toBe(expectedColor);
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

  it.each([
    ['vi', 'Đã đến lượt của bạn', 'Mở thông tin lượt'],
    ['en', 'It is your turn', 'Open ticket'],
  ] as const)('localizes Flex and text fallback for %s', (locale, headline, buttonLabel) => {
    const notification = buildTicketNotification({
      eventType: 'called',
      ticketCode: 'A019',
      ticketUrl: 'https://queue.example.com/liff/tickets/entry-123',
      aheadCount: 0,
      estimatedWaitSeconds: 0,
      locale,
    });

    expect(notification.textMessage).toContain(headline);
    expect(notification.flexMessage.contents).toMatchObject({
      footer: { contents: [{ action: { label: buttonLabel } }] },
    });
  });

  it('uses Japanese as the default locale', () => {
    const notification = buildTicketNotification({
      eventType: 'called',
      ticketCode: 'A019',
      ticketUrl: 'https://queue.example.com/ticket',
    });
    expect(notification.textMessage).toContain('順番になりました');
  });

  it('displays order number prominently when provided with ticket code secondary', () => {
    const notification = buildTicketNotification({
      eventType: 'booking_created',
      ticketCode: 'A016',
      orderNumber: 'PA-016',
      ticketUrl: 'https://queue.example.com/liff/tickets/entry-123',
      aheadCount: 3,
      estimatedWaitSeconds: 600,
    });

    expect(notification.flexMessage.altText).toContain('注文番号 PA-016 (受付番号 A016)');
    expect(notification.textMessage).toContain('注文番号: PA-016');
    expect(notification.textMessage).toContain('受付番号: A016');
    expect(notification.flexMessage.contents).toMatchObject({
      type: 'bubble',
      body: {
        contents: expect.arrayContaining([
          expect.objectContaining({ text: '注文番号' }),
          expect.objectContaining({ text: 'PA-016' }),
          expect.objectContaining({ text: '受付番号: A016' }),
        ]),
      },
    });
  });
});
