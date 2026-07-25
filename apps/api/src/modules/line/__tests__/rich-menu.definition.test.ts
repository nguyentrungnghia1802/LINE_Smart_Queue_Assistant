import {
  buildLiffRichMenuUri,
  buildSmartQueueRichMenuDefinition,
  RICH_MENU_ROUTES,
} from '../rich-menu.definition';

describe('rich-menu.definition', () => {
  it('builds the four centralized Rich Menu areas', () => {
    const definition = buildSmartQueueRichMenuDefinition({
      liffId: '1234567890-AbCdEfGh',
      webOrigin: 'https://queue.example.com',
    });

    expect(definition.name).toBe('line-smart-queue-main-v1');
    expect(definition.chatBarText).toBe('メニュー');
    expect(definition.areas).toHaveLength(4);
    expect(definition.areas.map((area) => area.action.label)).toEqual([
      'ホーム',
      '予約する',
      '現在の受付',
      '利用案内',
    ]);
  });

  it('uses LIFF permanent links that do not require a fixed entry ID', () => {
    const definition = buildSmartQueueRichMenuDefinition({
      liffId: '1234567890-AbCdEfGh',
      liffEndpointPath: '/liff',
    });

    for (const [index, route] of RICH_MENU_ROUTES.entries()) {
      const additionalPath = route.path.slice('/liff'.length);
      expect(definition.areas[index].action.uri).toBe(
        `https://liff.line.me/1234567890-AbCdEfGh${additionalPath}`
      );
      expect(definition.areas[index].action.uri).not.toContain('/liff/tickets/');
    }
  });

  it('does not duplicate the LIFF endpoint path', () => {
    expect(
      buildLiffRichMenuUri('/liff/home', {
        liffId: '1234567890-AbCdEfGh',
        liffEndpointPath: '/liff',
      })
    ).toBe('https://liff.line.me/1234567890-AbCdEfGh/home');
  });

  it('supports a LIFF endpoint configured at the web root', () => {
    expect(
      buildLiffRichMenuUri('/liff/home', {
        liffId: '1234567890-AbCdEfGh',
        liffEndpointPath: '/',
      })
    ).toBe('https://liff.line.me/1234567890-AbCdEfGh/liff/home');
  });

  it('falls back to a web URL when LIFF ID is not configured', () => {
    expect(buildLiffRichMenuUri('/liff/home', { webOrigin: 'https://queue.example.com/' })).toBe(
      'https://queue.example.com/liff/home'
    );
  });
});
