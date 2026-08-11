import { spawnSync } from 'node:child_process';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function docker(args, { allowFailure = false } = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    stdio: allowFailure ? 'ignore' : 'inherit',
  });

  if (!allowFailure && result.status !== 0) {
    throw new Error(`docker ${args[0]} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

const image = option('--image', 'line-smart-queue-api:media-persistence-validation');
const suffix = `${process.pid}-${Date.now()}`;
const volume = `sqa-media-persistence-${suffix}`;
const writer = `sqa-media-writer-${suffix}`;
const reader = `sqa-media-reader-${suffix}`;
const token = `persistent-across-recreate-${suffix}`;

try {
  docker(['volume', 'create', volume]);
  docker([
    'run',
    '--name',
    writer,
    '--rm',
    '-e',
    `MEDIA_PERSISTENCE_TOKEN=${token}`,
    '-v',
    `${volume}:/app/var/media`,
    '--entrypoint',
    'sh',
    image,
    '-eu',
    '-c',
    'test "$(id -u)" = "1001"; printf "%s" "$MEDIA_PERSISTENCE_TOKEN" > /app/var/media/.persistence-probe',
  ]);
  docker([
    'run',
    '--name',
    reader,
    '--rm',
    '-e',
    `MEDIA_PERSISTENCE_TOKEN=${token}`,
    '-v',
    `${volume}:/app/var/media`,
    '--entrypoint',
    'sh',
    image,
    '-eu',
    '-c',
    'test "$(cat /app/var/media/.persistence-probe)" = "$MEDIA_PERSISTENCE_TOKEN"',
  ]);

  console.log('MEDIA_PERSISTENCE_OK: a recreated non-root API container read the persisted file');
} finally {
  docker(['rm', '--force', writer], { allowFailure: true });
  docker(['rm', '--force', reader], { allowFailure: true });
  docker(['volume', 'rm', '--force', volume], { allowFailure: true });
}
