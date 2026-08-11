import { config } from '../../config';
import { pool, updatePoolMetrics } from '../../db/client';
import { redisService } from '../../infrastructure/redis';
import { scheduler } from '../../jobs/scheduler';
import { metricsService } from '../../utils/metrics';
import { notificationOutboxRepository } from '../notifications/notification-outbox.repository';

export type OperationalStatus =
  'healthy' | 'degraded' | 'unavailable' | 'not_configured' | 'not_applicable';

interface HealthComponent {
  status: OperationalStatus;
  reasonCode?: string;
}

interface WorkerHeartbeatPayload {
  status: 'ready' | 'degraded';
  updatedAt: string;
}

function parseHeartbeat(value: string | null): WorkerHeartbeatPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<WorkerHeartbeatPayload>;
    if (
      (parsed.status === 'ready' || parsed.status === 'degraded') &&
      typeof parsed.updatedAt === 'string' &&
      Number.isFinite(Date.parse(parsed.updatedAt))
    ) {
      return { status: parsed.status, updatedAt: parsed.updatedAt };
    }
  } catch {
    // Invalid ephemeral heartbeat data is treated as unavailable.
  }
  return null;
}

function overallStatus(components: HealthComponent[]): OperationalStatus {
  if (components.some((component) => component.status === 'unavailable')) return 'unavailable';
  if (components.some((component) => component.status === 'degraded')) return 'degraded';
  return 'healthy';
}

export const operationalHealthService = {
  async getSnapshot() {
    const checkedAt = new Date();
    let postgres: HealthComponent = { status: 'healthy' };
    try {
      await pool.query('SELECT 1');
      updatePoolMetrics();
    } catch {
      postgres = { status: 'unavailable', reasonCode: 'POSTGRES_PROBE_FAILED' };
    }

    const redisHealth = redisService.health();
    const redisPing = redisHealth.enabled ? await redisService.ping() : false;
    const redis: HealthComponent = !redisHealth.enabled
      ? { status: 'not_configured', reasonCode: 'REDIS_NOT_CONFIGURED' }
      : redisPing
        ? { status: 'healthy' }
        : { status: 'degraded', reasonCode: 'REDIS_PING_FAILED' };

    let worker: HealthComponent & { lastHeartbeatAt?: string } =
      config.bullmq.notificationDeliveryOwner === 'api'
        ? {
            status: scheduler.status().running ? 'healthy' : 'degraded',
            reasonCode: 'WORKER_OWNED_BY_API',
          }
        : { status: 'unavailable', reasonCode: 'WORKER_HEARTBEAT_MISSING' };

    if (config.bullmq.notificationDeliveryOwner === 'bullmq' && redisPing) {
      const raw = await redisService
        .execute((client) => client.get(`${config.redis.keyPrefix}:worker:heartbeat`))
        .catch(() => null);
      const heartbeat = parseHeartbeat(raw);
      if (heartbeat) {
        const ageMs = checkedAt.getTime() - Date.parse(heartbeat.updatedAt);
        worker = {
          status:
            heartbeat.status === 'ready' && ageMs <= config.bullmq.heartbeatIntervalMs * 3
              ? 'healthy'
              : 'degraded',
          lastHeartbeatAt: heartbeat.updatedAt,
          reasonCode: heartbeat.status === 'ready' ? undefined : 'WORKER_REPORTED_DEGRADED',
        };
      }
    }

    const notificationMetrics =
      postgres.status === 'healthy'
        ? await notificationOutboxRepository.deliveryMetrics().catch(() => null)
        : null;
    const pending = Number(notificationMetrics?.pending ?? 0);
    const failed = Number(notificationMetrics?.failed ?? 0);
    const oldestPendingSeconds = Number(notificationMetrics?.oldest_pending_seconds ?? 0);
    const notifications: HealthComponent & {
      pending: number;
      retrying: number;
      failed: number;
      oldestPendingSeconds: number;
    } = {
      status:
        notificationMetrics === null
          ? 'unavailable'
          : failed > 0 || oldestPendingSeconds > 300
            ? 'degraded'
            : 'healthy',
      pending,
      retrying: Number(notificationMetrics?.retrying ?? 0),
      failed,
      oldestPendingSeconds,
      ...(notificationMetrics === null ? { reasonCode: 'NOTIFICATION_AGGREGATE_FAILED' } : {}),
    };

    const lineConfigured = Boolean(
      config.line.messagingChannelAccessToken && config.line.messagingChannelSecret
    );
    const line: HealthComponent = lineConfigured
      ? { status: 'healthy' }
      : { status: 'not_configured', reasonCode: 'LINE_NOT_CONFIGURED' };

    const payment: HealthComponent & { mode: 'demo' | 'external'; provider: 'demo' | 'payos' } = {
      status: 'healthy',
      mode: config.payments.mode,
      provider: config.payments.mode === 'demo' ? 'demo' : 'payos',
      reasonCode: config.payments.mode === 'demo' ? 'PAYMENT_DEMO_ACTIVE' : undefined,
    };

    const gauges = metricsService.gaugeSnapshot();
    const counters = metricsService.snapshot();
    const realtime: HealthComponent & { activeConnections: number } = {
      status: redis.status === 'degraded' ? 'degraded' : 'healthy',
      activeConnections: gauges.sse_active_connections,
      reasonCode: redis.status === 'degraded' ? 'REALTIME_FANOUT_DEGRADED' : undefined,
    };

    const components = {
      api: { status: 'healthy' as const },
      postgres,
      redis,
      worker,
      realtime,
      line,
      payment,
    };
    return {
      status: overallStatus([postgres, redis, worker, realtime, notifications]),
      checkedAt: checkedAt.toISOString(),
      environment: config.observability.environment,
      release: config.observability.release || 'unknown',
      uptimeSeconds: Math.floor(process.uptime()),
      components,
      notifications,
      indicators: {
        requestCount: counters.requests_total,
        errorCount: counters.errors_total,
        requestErrorRate:
          counters.requests_total > 0 ? counters.errors_total / counters.requests_total : 0,
        requestLatencySeconds: gauges.http_request_latency_seconds,
        notificationDeliveryLatencySeconds: Number(notificationMetrics?.latency_seconds ?? 0),
        postgresPool: {
          total: gauges.postgres_pool_total,
          idle: gauges.postgres_pool_idle,
          waiting: gauges.postgres_pool_waiting,
        },
      },
    };
  },
};

export const operationalHealthInternals = { parseHeartbeat, overallStatus };
