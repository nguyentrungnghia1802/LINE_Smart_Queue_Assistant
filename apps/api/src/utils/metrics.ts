type CounterName =
  | 'requests_total'
  | 'errors_total'
  | 'queue_created_total'
  | 'queue_served_total'
  | 'queue_cancelled_total'
  | 'notifications_sent_total'
  | 'notifications_failed_total'
  | 'notifications_outbox_sent_total'
  | 'notifications_outbox_failed_total'
  | 'notifications_outbox_retry_scheduled_total'
  | 'email_outbox_sent_total'
  | 'email_outbox_failed_total'
  | 'email_outbox_retry_scheduled_total'
  | 'redis_connection_errors_total'
  | 'redis_command_timeouts_total'
  | 'redis_rate_limit_fallback_total'
  | 'redis_cache_hits_total'
  | 'redis_cache_misses_total'
  | 'redis_cache_errors_total'
  | 'bullmq_worker_start_errors_total'
  | 'bullmq_jobs_completed_total'
  | 'bullmq_jobs_failed_total'
  | 'bullmq_invalid_jobs_total'
  | 'notifications_dispatched_total'
  | 'notifications_dispatch_failed_total'
  | 'line_provider_failures_total';

const counters: Record<CounterName, number> = {
  requests_total: 0,
  errors_total: 0,
  queue_created_total: 0,
  queue_served_total: 0,
  queue_cancelled_total: 0,
  notifications_sent_total: 0,
  notifications_failed_total: 0,
  notifications_outbox_sent_total: 0,
  notifications_outbox_failed_total: 0,
  notifications_outbox_retry_scheduled_total: 0,
  email_outbox_sent_total: 0,
  email_outbox_failed_total: 0,
  email_outbox_retry_scheduled_total: 0,
  redis_connection_errors_total: 0,
  redis_command_timeouts_total: 0,
  redis_rate_limit_fallback_total: 0,
  redis_cache_hits_total: 0,
  redis_cache_misses_total: 0,
  redis_cache_errors_total: 0,
  bullmq_worker_start_errors_total: 0,
  bullmq_jobs_completed_total: 0,
  bullmq_jobs_failed_total: 0,
  bullmq_invalid_jobs_total: 0,
  notifications_dispatched_total: 0,
  notifications_dispatch_failed_total: 0,
  line_provider_failures_total: 0,
};

type GaugeName =
  | 'notifications_outbox_backlog'
  | 'notifications_outbox_retry_backlog'
  | 'notifications_outbox_failed'
  | 'notifications_delivery_latency_seconds'
  | 'redis_cache_hit_ratio'
  | 'redis_cache_latency_seconds'
  | 'bullmq_worker_ready'
  | 'bullmq_worker_active_jobs'
  | 'notifications_undispatched'
  | 'notifications_oldest_undispatched_seconds'
  | 'bullmq_jobs_waiting'
  | 'bullmq_jobs_delayed'
  | 'bullmq_jobs_failed'
  | 'notification_worker_processing_seconds'
  | 'line_provider_latency_seconds';

const gauges: Record<GaugeName, number> = {
  notifications_outbox_backlog: 0,
  notifications_outbox_retry_backlog: 0,
  notifications_outbox_failed: 0,
  notifications_delivery_latency_seconds: 0,
  redis_cache_hit_ratio: 0,
  redis_cache_latency_seconds: 0,
  bullmq_worker_ready: 0,
  bullmq_worker_active_jobs: 0,
  notifications_undispatched: 0,
  notifications_oldest_undispatched_seconds: 0,
  bullmq_jobs_waiting: 0,
  bullmq_jobs_delayed: 0,
  bullmq_jobs_failed: 0,
  notification_worker_processing_seconds: 0,
  line_provider_latency_seconds: 0,
};

export const metricsService = {
  increment(name: CounterName, value = 1): void {
    counters[name] += value;
  },

  snapshot(): Record<CounterName, number> {
    return { ...counters };
  },

  setGauge(name: GaugeName, value: number): void {
    gauges[name] = Number.isFinite(value) ? value : 0;
  },

  toPrometheus(): string {
    return [...Object.entries(counters), ...Object.entries(gauges)]
      .map(([name, value]) => `line_queue_${name} ${value}`)
      .join('\n')
      .concat('\n');
  },

  resetForTests(): void {
    for (const key of Object.keys(counters) as CounterName[]) {
      counters[key] = 0;
    }
    for (const key of Object.keys(gauges) as GaugeName[]) gauges[key] = 0;
  },
};
