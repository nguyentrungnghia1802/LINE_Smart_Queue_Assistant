import { LineRichMenuSdkAdapter } from '../rich-menu.adapter';

describe('LineRichMenuSdkAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uploads Rich Menu images through the LINE data API host', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('', {
        status: 200,
      })
    );
    const adapter = new LineRichMenuSdkAdapter('test-token');

    await adapter.uploadRichMenuImage('rich-menu-1', Buffer.from('image'), 'image/png');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api-data.line.me/v2/bot/richmenu/rich-menu-1/content',
      expect.objectContaining({
        body: Buffer.from('image'),
        method: 'POST',
      })
    );
  });
});
