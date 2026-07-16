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
  | 'notifications_outbox_retry_scheduled_total';

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
};

type GaugeName =
  | 'notifications_outbox_backlog'
  | 'notifications_outbox_retry_backlog'
  | 'notifications_outbox_failed'
  | 'notifications_delivery_latency_seconds';

const gauges: Record<GaugeName, number> = {
  notifications_outbox_backlog: 0,
  notifications_outbox_retry_backlog: 0,
  notifications_outbox_failed: 0,
  notifications_delivery_latency_seconds: 0,
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
