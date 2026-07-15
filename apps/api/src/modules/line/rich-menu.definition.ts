import type { RichMenuDefinition } from './rich-menu.types';

export const SMART_QUEUE_RICH_MENU_NAME = 'line-smart-queue-main-v1';

const RICH_MENU_WIDTH = 2500;
const RICH_MENU_HEIGHT = 843;
const ITEM_WIDTH = RICH_MENU_WIDTH / 4;

export type RichMenuItemKey = 'home' | 'booking' | 'current_ticket' | 'guide';

export interface RichMenuRoute {
  key: RichMenuItemKey;
  label: string;
  path: string;
}

export const RICH_MENU_ROUTES: RichMenuRoute[] = [
  { key: 'home', label: 'ホーム', path: '/liff/home' },
  { key: 'booking', label: '予約する', path: '/liff/home?mode=booking' },
  { key: 'current_ticket', label: '現在の受付', path: '/liff/home?mode=ticket' },
  { key: 'guide', label: '利用案内', path: '/liff/home?section=guide' },
];

export function buildLiffRichMenuUri(
  path: string,
  options: { liffId?: string; webOrigin?: string }
): string {
  if (options.liffId) {
    return `https://liff.line.me/${options.liffId}?liff.state=${encodeURIComponent(path)}`;
  }
  const origin = (options.webOrigin ?? 'http://localhost:5173').replace(/\/$/, '');
  return `${origin}${path}`;
}

export function buildSmartQueueRichMenuDefinition(options: {
  liffId?: string;
  webOrigin?: string;
}): RichMenuDefinition {
  return {
    size: {
      width: RICH_MENU_WIDTH,
      height: RICH_MENU_HEIGHT,
    },
    selected: true,
    name: SMART_QUEUE_RICH_MENU_NAME,
    chatBarText: 'メニュー',
    areas: RICH_MENU_ROUTES.map((route, index) => ({
      bounds: {
        x: Math.round(index * ITEM_WIDTH),
        y: 0,
        width:
          index === RICH_MENU_ROUTES.length - 1
            ? RICH_MENU_WIDTH - Math.round(index * ITEM_WIDTH)
            : ITEM_WIDTH,
        height: RICH_MENU_HEIGHT,
      },
      action: {
        type: 'uri',
        label: route.label,
        uri: buildLiffRichMenuUri(route.path, options),
      },
    })),
  };
}
