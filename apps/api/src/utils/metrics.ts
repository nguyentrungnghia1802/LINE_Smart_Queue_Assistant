type CounterName =
  | 'requests_total'
  | 'errors_total'
  | 'queue_created_total'
  | 'queue_served_total'
  | 'queue_cancelled_total'
  | 'notifications_sent_total'
  | 'notifications_failed_total';

const counters: Record<CounterName, number> = {
  requests_total: 0,
  errors_total: 0,
  queue_created_total: 0,
  queue_served_total: 0,
  queue_cancelled_total: 0,
  notifications_sent_total: 0,
  notifications_failed_total: 0,
};

export const metricsService = {
  increment(name: CounterName, value = 1): void {
    counters[name] += value;
  },

  snapshot(): Record<CounterName, number> {
    return { ...counters };
  },

  toPrometheus(): string {
    return Object.entries(counters)
      .map(([name, value]) => `line_queue_${name} ${value}`)
      .join('\n')
      .concat('\n');
  },

  resetForTests(): void {
    for (const key of Object.keys(counters) as CounterName[]) {
      counters[key] = 0;
    }
  },
};
