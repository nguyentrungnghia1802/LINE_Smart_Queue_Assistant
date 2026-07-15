import fs from 'node:fs/promises';
import path from 'node:path';

import type { RichMenuImageConfig } from './rich-menu.types';

const TRANSPARENT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lz9R8wAAAABJRU5ErkJggg==';

export async function loadRichMenuImageConfig(imagePath?: string): Promise<RichMenuImageConfig> {
  if (!imagePath) {
    return {
      buffer: Buffer.from(TRANSPARENT_PNG_BASE64, 'base64'),
      contentType: 'image/png',
      source: 'generated-placeholder',
    };
  }

  const resolved = path.resolve(imagePath);
  const ext = path.extname(resolved).toLowerCase();
  const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';

  return {
    buffer: await fs.readFile(resolved),
    contentType,
    source: resolved,
  };
}
