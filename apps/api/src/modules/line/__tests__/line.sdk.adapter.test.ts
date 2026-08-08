import { LineProviderError, LineSdkAdapter } from '../line.sdk.adapter';

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

  it('maps 429 and Retry-After into a retryable provider error', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '12' } }));
    const adapter = new LineSdkAdapter('secret-token');

    await expect(adapter.pushMessage('U123', [{ type: 'text', text: 'retry' }])).rejects.toEqual(
      expect.objectContaining<Partial<LineProviderError>>({
        statusCode: 429,
        retryAfterMs: 12_000,
        retryable: true,
      })
    );
  });

  it('maps provider 4xx to permanent and transport failures to retryable errors', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 400 }))
      .mockRejectedValueOnce(new Error('socket timeout'));
    const adapter = new LineSdkAdapter('secret-token');

    await expect(adapter.pushMessage('U123', [{ type: 'text', text: 'invalid' }])).rejects.toEqual(
      expect.objectContaining<Partial<LineProviderError>>({ statusCode: 400, retryable: false })
    );
    await expect(adapter.pushMessage('U123', [{ type: 'text', text: 'timeout' }])).rejects.toEqual(
      expect.objectContaining<Partial<LineProviderError>>({ statusCode: null, retryable: true })
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
