import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const assetsDir = fileURLToPath(new URL('../dist/assets/', import.meta.url));
const unsafePatterns = ['eval' + '(', 'new ' + 'Function'];
const assetNames = await readdir(assetsDir);
const violations = [];

for (const assetName of assetNames.filter((name) => name.endsWith('.js'))) {
  const contents = await readFile(join(assetsDir, assetName), 'utf8');
  for (const pattern of unsafePatterns) {
    if (contents.includes(pattern)) violations.push(`${assetName}: ${pattern}`);
  }
}

if (violations.length > 0) {
  throw new Error(`CSP-unsafe dynamic JavaScript found:\n${violations.join('\n')}`);
}

// eslint-disable-next-line no-console
console.log('CSP bundle check passed.');
