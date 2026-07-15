import {
  buildTicketDeepLink,
  ticketCalledMessage,
  ticketCompletedMessage,
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
});
