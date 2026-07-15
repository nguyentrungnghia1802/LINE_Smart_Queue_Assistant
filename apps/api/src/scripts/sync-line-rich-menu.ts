import { config } from '../config';
import { buildSmartQueueRichMenuDefinition } from '../modules/line/rich-menu.definition';
import { loadRichMenuImageConfig } from '../modules/line/rich-menu.image';
import { syncRichMenu } from '../modules/line/rich-menu.sync.service';
import { createLineRichMenuAdapter } from '../modules/line/rich-menu.transport';

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main(): Promise<void> {
  const replace = hasFlag('--replace');
  const definition = buildSmartQueueRichMenuDefinition({
    liffId: config.line.liffId,
    webOrigin: config.web.origin,
  });
  const image = await loadRichMenuImageConfig(config.line.richMenuImagePath);
  const adapter = createLineRichMenuAdapter();

  const result = await syncRichMenu({
    adapter,
    definition,
    image,
    replace,
  });

  console.info(
    [
      'LINE Rich Menu sync completed',
      `richMenuId=${result.richMenuId}`,
      `created=${result.created}`,
      `replaced=${result.replaced}`,
      `deleted=${result.deletedRichMenuIds.length}`,
      `image=${result.imageSource}`,
    ].join(' ')
  );

  if (image.source === 'generated-placeholder') {
    console.warn(
      'LINE_RICH_MENU_IMAGE_PATH is not configured. A placeholder image was used for mock/dev sync.'
    );
  }
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : 'LINE Rich Menu sync failed');
  process.exitCode = 1;
});
