import { logger } from '../../utils/logger';

import type { ILineRichMenuAdapter } from './rich-menu.adapter';
import { SMART_QUEUE_RICH_MENU_NAME } from './rich-menu.definition';
import type { RichMenuDefinition, RichMenuImageConfig } from './rich-menu.types';

export interface RichMenuSyncOptions {
  adapter: ILineRichMenuAdapter;
  definition: RichMenuDefinition;
  image: RichMenuImageConfig;
  replace?: boolean;
}

export interface RichMenuSyncResult {
  richMenuId: string;
  created: boolean;
  replaced: boolean;
  deletedRichMenuIds: string[];
  imageSource: string;
}

export class RichMenuSyncError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'RichMenuSyncError';
  }
}

export async function syncRichMenu(options: RichMenuSyncOptions): Promise<RichMenuSyncResult> {
  const { adapter, definition, image, replace = false } = options;
  const deletedRichMenuIds: string[] = [];

  try {
    const existing = (await adapter.listRichMenus()).filter(
      (menu) => menu.name === definition.name
    );
    const [primary, ...duplicates] = existing;

    if (replace) {
      for (const menu of existing) {
        await adapter.deleteRichMenu(menu.richMenuId);
        deletedRichMenuIds.push(menu.richMenuId);
      }
    } else {
      for (const menu of duplicates) {
        await adapter.deleteRichMenu(menu.richMenuId);
        deletedRichMenuIds.push(menu.richMenuId);
      }
    }

    const richMenuId =
      !replace && primary ? primary.richMenuId : await adapter.createRichMenu(definition);

    await adapter.uploadRichMenuImage(richMenuId, image.buffer, image.contentType);
    await adapter.setDefaultRichMenu(richMenuId);

    return {
      richMenuId,
      created: replace || !primary,
      replaced: replace,
      deletedRichMenuIds,
      imageSource: image.source,
    };
  } catch (err) {
    logger.error(
      {
        err,
        richMenuName: definition.name || SMART_QUEUE_RICH_MENU_NAME,
      },
      'LINE Rich Menu sync failed'
    );
    throw new RichMenuSyncError(
      'LINE Rich Menu sync failed. Check LINE credentials and image.',
      err
    );
  }
}
