import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { runLoadTest } from './http-load.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const composeFile = 'docker-compose.validation.yml';
const project = 'sqa-task-11';
const gateway = process.env.VALIDATION_GATEWAY_URL ?? 'http://127.0.0.1:4180';
const keepStack = process.argv.includes('--keep');
const report = {
  generatedAt: new Date().toISOString(),
  topology: 'nginx -> api-1/api-2 -> shared PostgreSQL/Redis; dedicated worker',
  checks: {},
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    shell: process.platform === 'win32',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status})\n${result.stdout ?? ''}\n${result.stderr ?? ''}`
    );
  }
  return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
}

function dockerCompose(args, options) {
  return run('docker', ['compose', '-p', project, '-f', composeFile, ...args], options);
}

async function waitFor(url, expectedStatus = 200, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      lastStatus = response.status;
      await response.arrayBuffer();
      if (response.status === expectedStatus) return;
    } catch {
      // The dependency is still recovering.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`Timed out waiting for ${url}; last status ${lastStatus || 'unreachable'}`);
}

async function requestJson(path, init = {}) {
  const response = await fetch(`${gateway}${path}`, init);
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function login(path, payload) {
  const { response, body } = await requestJson(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok || !body?.data?.token) {
    throw new Error(`Login failed at ${path} with HTTP ${response.status}`);
  }
  return body.data.token;
}

function sql(statement) {
  return dockerCompose(
    [
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'postgres',
      '-d',
      'line_queue_validation',
      '-tAc',
      statement,
    ],
    { capture: true }
  );
}

function parsePrometheus(value) {
  return Object.fromEntries(
    value
      .split('\n')
      .filter((line) => line.startsWith('line_queue_'))
      .map((line) => {
        const [name, metricValue] = line.trim().split(/\s+/);
        return [name, Number(metricValue)];
      })
  );
}

async function metrics(instance) {
  const response = await fetch(`${gateway}/validation/${instance}/metrics`);
  if (!response.ok) throw new Error(`Metrics for ${instance} returned ${response.status}`);
  return parsePrometheus(await response.text());
}

async function verifyCrossInstanceSse(staffToken) {
  const controller = new AbortController();
  const streamResponse = await fetch(
    `${gateway}/validation/api-1/api/v1/realtime/queues/33333333-3333-4333-8333-333333333331`,
    {
      headers: { authorization: `Bearer ${staffToken}` },
      signal: controller.signal,
    }
  );
  if (!streamResponse.ok || !streamResponse.body) {
    throw new Error(`SSE stream failed with HTTP ${streamResponse.status}`);
  }

  const reader = streamResponse.body.getReader();
  const decoder = new TextDecoder();
  let received = '';
  const eventPromise = (async () => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const { done, value } = await reader.read();
      if (done) break;
      received += decoder.decode(value, { stream: true });
      if (received.includes('event: ticket.deferred')) return true;
    }
    return false;
  })();

  await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
  const transition = await fetch(
    `${gateway}/validation/api-2/api/v1/staff/entries/66666666-6666-4666-8666-666666666503/defer`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${staffToken}` },
    }
  );
  await transition.arrayBuffer();
  if (!transition.ok) {
    controller.abort();
    throw new Error(`Cross-instance staff transition returned HTTP ${transition.status}`);
  }

  const receivedCrossInstanceEvent = await Promise.race([
    eventPromise,
    new Promise((resolveTimeout) => setTimeout(() => resolveTimeout(false), 10_000)),
  ]);
  controller.abort();
  await reader.cancel().catch(() => undefined);
  if (!receivedCrossInstanceEvent) throw new Error('Cross-instance SSE event was not received');
  return true;
}

async function main() {
  dockerCompose(['down', '--volumes', '--remove-orphans'], { allowFailure: true });
  dockerCompose(['build', 'api-1', 'setup', 'gateway']);
  dockerCompose(['up', '-d', 'postgres', 'redis']);
  dockerCompose(['run', '--rm', 'setup']);

  dockerCompose(['up', '-d', 'api-1', 'api-2', 'gateway']);
  await waitFor(`${gateway}/ready`);

  const adminToken = await login('/api/v1/auth/login', {
    email: 'admin@gmail.com',
    password: '123456',
  });
  const staffToken = await login('/api/v1/auth/login', {
    email: 'staff@gmail.com',
    password: '123456',
  });
  const authUpstreams = new Set();
  for (let index = 0; index < 8; index += 1) {
    const response = await fetch(`${gateway}/api/v1/admin/dashboard`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    await response.arrayBuffer();
    if (!response.ok) throw new Error(`Cross-instance auth returned HTTP ${response.status}`);
    const upstream = response.headers.get('x-sqa-upstream');
    if (upstream) authUpstreams.add(upstream);
  }
  if (authUpstreams.size < 2) throw new Error('Load balancer did not exercise both API replicas');
  report.checks.crossInstanceAuthentication = { passed: true, upstreams: [...authUpstreams] };

  report.checks.publicQueueReadLoad = await runLoadTest({
    url: `${gateway}/api/v1/orgs/by-token/demo-queue-lab-2026`,
    requests: 160,
    concurrency: 10,
    warmup: 10,
  });
  if (report.checks.publicQueueReadLoad.errors !== 0) {
    throw new Error('Queue-read load test returned errors');
  }

  let strictRequests = 0;
  let strictLimitedAt = null;
  const strictUpstreams = new Set();
  for (; strictRequests < 130; strictRequests += 1) {
    const response = await fetch(`${gateway}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'missing@example.com', password: 'invalid-password' }),
    });
    await response.arrayBuffer();
    const upstream = response.headers.get('x-sqa-upstream');
    if (upstream) strictUpstreams.add(upstream);
    if (response.status === 429) {
      strictLimitedAt = strictRequests + 1;
      break;
    }
  }
  if (!strictLimitedAt || strictUpstreams.size < 2 || strictLimitedAt > 19) {
    throw new Error('Shared strict rate limit was not enforced across both replicas');
  }
  report.checks.distributedRateLimit = {
    passed: true,
    limitedAtRequest: strictLimitedAt,
    upstreams: [...strictUpstreams],
  };

  dockerCompose(['exec', '-T', 'redis', 'redis-cli', 'FLUSHALL']);
  const cacheLoss = await fetch(`${gateway}/api/v1/orgs/by-token/demo-queue-lab-2026`);
  await cacheLoss.arrayBuffer();
  if (!cacheLoss.ok) throw new Error('PostgreSQL fallback failed after cache loss');
  report.checks.cacheLoss = { passed: true, status: cacheLoss.status };

  dockerCompose(['stop', 'redis']);
  const redisDownRead = await fetch(`${gateway}/api/v1/orgs/by-token/demo-queue-lab-2026`);
  await redisDownRead.arrayBuffer();
  const redisDownAuth = await fetch(`${gateway}/api/v1/admin/dashboard`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  await redisDownAuth.arrayBuffer();
  if (!redisDownRead.ok || !redisDownAuth.ok) {
    throw new Error('Redis outage changed authoritative read/auth behavior');
  }
  report.checks.redisOutage = {
    passed: true,
    publicReadStatus: redisDownRead.status,
    authenticatedReadStatus: redisDownAuth.status,
  };
  dockerCompose(['start', 'redis']);
  await waitFor(`${gateway}/ready`);

  const pendingBeforeWorker = Number(
    sql("SELECT COUNT(*) FROM notifications WHERE status IN ('pending','processing')")
  );
  if (pendingBeforeWorker < 1) throw new Error('Fixture has no durable pending notification');
  dockerCompose(['up', '-d', 'worker']);
  const deliveryDeadline = Date.now() + 45_000;
  let seedEtaStatus = '';
  while (Date.now() < deliveryDeadline) {
    seedEtaStatus = sql(
      "SELECT status FROM notifications WHERE event_key LIKE 'seed:%:eta_warning'"
    );
    if (seedEtaStatus === 'sent') break;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
  }
  if (seedEtaStatus !== 'sent')
    throw new Error(`Worker did not recover outbox row: ${seedEtaStatus}`);
  report.checks.durableWorkerRecovery = {
    passed: true,
    pendingWhileStopped: pendingBeforeWorker,
    statusAfterStart: seedEtaStatus,
  };

  report.checks.crossInstanceSse = {
    passed: await verifyCrossInstanceSse(staffToken),
    source: 'api-2 defer transition',
    subscriber: 'api-1 SSE',
  };

  dockerCompose(['restart', 'api-1']);
  await waitFor(`${gateway}/ready`);
  const restRecovery = await fetch(`${gateway}/api/v1/staff/my-queue`, {
    headers: { authorization: `Bearer ${staffToken}` },
  });
  await restRecovery.arrayBuffer();
  if (!restRecovery.ok) throw new Error(`REST recovery returned HTTP ${restRecovery.status}`);
  report.checks.apiRestartRestRecovery = { passed: true, status: restRecovery.status };

  dockerCompose(['stop', 'postgres']);
  await waitFor(`${gateway}/validation/api-2/ready`, 503, 15_000);
  dockerCompose(['start', 'postgres']);
  await waitFor(`${gateway}/ready`, 200, 45_000);
  report.checks.databaseInterruption = { passed: true, readinessDuringOutage: 503 };

  const [api1Metrics, api2Metrics] = await Promise.all([metrics('api-1'), metrics('api-2')]);
  const databaseStats = sql(
    "SELECT json_build_object('connections', numbackends, 'commits', xact_commit, 'rollbacks', xact_rollback, 'rowsReturned', tup_returned, 'rowsFetched', tup_fetched)::text FROM pg_stat_database WHERE datname = 'line_queue_validation'"
  );
  const outboxAgeSeconds = Number(
    sql(
      "SELECT COALESCE(EXTRACT(EPOCH FROM NOW() - MIN(created_at)), 0)::bigint FROM notifications WHERE status IN ('pending','processing')"
    )
  );
  const containerStats = run(
    'docker',
    [
      'stats',
      '--no-stream',
      '--format',
      '{{json .}}',
      `${project}-api-1-1`,
      `${project}-api-2-1`,
      `${project}-worker-1`,
      `${project}-postgres-1`,
      `${project}-redis-1`,
    ],
    { capture: true, allowFailure: true }
  )
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });

  report.measurements = {
    apiMetrics: { api1: api1Metrics, api2: api2Metrics },
    postgres: JSON.parse(databaseStats),
    notificationOutboxOldestActiveSeconds: outboxAgeSeconds,
    containerStats,
  };

  await mkdir(resolve(root, 'var/scalability'), { recursive: true });
  const reportPath = resolve(root, 'var/scalability/task-11-report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`TASK-11 integrated validation passed. Report: ${reportPath}\n`);
}

try {
  await main();
} finally {
  if (!keepStack) {
    dockerCompose(['down', '--volumes', '--remove-orphans'], { allowFailure: true });
  }
}
