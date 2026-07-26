import { LineSdkAdapter } from '../line.sdk.adapter';

describe('LineSdkAdapter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends the durable delivery UUID as X-Line-Retry-Key for push messages', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    const adapter = new LineSdkAdapter('secret-token');
    const retryKey = '11111111-1111-4111-8111-111111111111';

    await adapter.pushMessage('U123', [{ type: 'text', text: '受付のお知らせ' }], { retryKey });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/message/push',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Line-Retry-Key': retryKey }),
      })
    );
  });
});
