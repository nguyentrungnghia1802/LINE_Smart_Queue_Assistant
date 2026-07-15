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

  it('uses LIFF state deeplinks that do not require a fixed entry ID', () => {
    const definition = buildSmartQueueRichMenuDefinition({
      liffId: '1234567890-AbCdEfGh',
    });

    for (const [index, route] of RICH_MENU_ROUTES.entries()) {
      expect(definition.areas[index].action.uri).toBe(
        `https://liff.line.me/1234567890-AbCdEfGh?liff.state=${encodeURIComponent(route.path)}`
      );
      expect(definition.areas[index].action.uri).not.toContain('/liff/tickets/');
    }
  });

  it('falls back to a web URL when LIFF ID is not configured', () => {
    expect(buildLiffRichMenuUri('/liff/home', { webOrigin: 'https://queue.example.com/' })).toBe(
      'https://queue.example.com/liff/home'
    );
  });
});
