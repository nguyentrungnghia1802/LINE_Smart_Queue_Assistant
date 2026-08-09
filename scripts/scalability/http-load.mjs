import { pathToFileURL } from 'node:url';

function percentile(sorted, value) {
  if (sorted.length === 0) return 0;
  const index = Math.max(0, Math.ceil((value / 100) * sorted.length) - 1);
  return sorted[index];
}

export async function runLoadTest({
  url,
  requests = 160,
  concurrency = 10,
  warmup = 10,
  headers = {},
}) {
  if (!url) throw new Error('A target URL is required');
  if (requests < 1 || concurrency < 1 || warmup < 0) {
    throw new Error('requests/concurrency must be positive and warmup cannot be negative');
  }

  for (let index = 0; index < warmup; index += 1) {
    const response = await fetch(url, { headers });
    await response.arrayBuffer();
    if (!response.ok) throw new Error(`Warm-up request failed with HTTP ${response.status}`);
  }

  const latencies = [];
  const statuses = {};
  const upstreams = new Set();
  let cursor = 0;
  const startedAt = performance.now();

  async function worker() {
    while (true) {
      const requestIndex = cursor;
      cursor += 1;
      if (requestIndex >= requests) return;

      const requestStartedAt = performance.now();
      try {
        const response = await fetch(url, { headers });
        await response.arrayBuffer();
        latencies.push(performance.now() - requestStartedAt);
        statuses[response.status] = (statuses[response.status] ?? 0) + 1;
        const upstream = response.headers.get('x-sqa-upstream');
        if (upstream) upstreams.add(upstream);
      } catch {
        latencies.push(performance.now() - requestStartedAt);
        statuses.network_error = (statuses.network_error ?? 0) + 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, () => worker()));

  const durationSeconds = (performance.now() - startedAt) / 1000;
  const sorted = [...latencies].sort((left, right) => left - right);
  const errors = Object.entries(statuses).reduce(
    (total, [status, count]) =>
      status === 'network_error' || Number(status) >= 400 ? total + count : total,
    0
  );

  return {
    url,
    requests,
    concurrency,
    durationSeconds: Number(durationSeconds.toFixed(3)),
    requestsPerSecond: Number((requests / durationSeconds).toFixed(2)),
    latencyMs: {
      p50: Number(percentile(sorted, 50).toFixed(2)),
      p95: Number(percentile(sorted, 95).toFixed(2)),
      p99: Number(percentile(sorted, 99).toFixed(2)),
      max: Number((sorted.at(-1) ?? 0).toFixed(2)),
    },
    statuses,
    errors,
    errorRate: Number((errors / requests).toFixed(4)),
    upstreams: [...upstreams].sort(),
  };
}

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await runLoadTest({
    url: option('url', 'http://127.0.0.1:4180/api/v1/orgs/by-token/demo-queue-lab-2026'),
    requests: Number.parseInt(option('requests', '160'), 10),
    concurrency: Number.parseInt(option('concurrency', '10'), 10),
    warmup: Number.parseInt(option('warmup', '10'), 10),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.errors > 0) process.exitCode = 1;
}
