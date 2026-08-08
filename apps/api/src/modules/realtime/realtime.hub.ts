import { config } from '../../config';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { metricsService } from '../../utils/metrics';

import {
  queueRealtimeChannel,
  realtimeChannels,
  type RealtimeEvent,
  type RealtimeEventScope,
  ticketRealtimeChannel,
} from './realtime.contract';
import { realtimePubSub, type RealtimePubSubTransport } from './realtime.pubsub';

interface RealtimeSubscription {
  id: number;
  userId: string;
  channel: string;
  openedAt: number;
  accepts: (event: RealtimeEvent) => boolean;
  onEvent: (event: RealtimeEvent) => void;
}

interface ChannelSubscription {
  ids: Set<number>;
  releaseTransport: () => Promise<void>;
}

export interface RealtimeHubOptions {
  keyPrefix: string;
  maxConnections: number;
  maxConnectionsPerUser: number;
}

export class RealtimeHub {
  private nextSubscriptionId = 1;
  private readonly subscriptions = new Map<number, RealtimeSubscription>();
  private readonly channels = new Map<string, ChannelSubscription>();
  private readonly locallyPublished = new Map<string, NodeJS.Timeout>();
  private readonly recentlyReceived = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly transport: RealtimePubSubTransport,
    private readonly options: RealtimeHubOptions
  ) {}

  async start(): Promise<void> {
    await this.transport.start();
  }

  async stop(): Promise<void> {
    for (const subscriptionId of [...this.subscriptions.keys()]) {
      await this.unsubscribe(subscriptionId);
    }
    for (const timeout of this.locallyPublished.values()) clearTimeout(timeout);
    for (const timeout of this.recentlyReceived.values()) clearTimeout(timeout);
    this.locallyPublished.clear();
    this.recentlyReceived.clear();
    await this.transport.stop();
  }

  async subscribe(input: {
    userId: string;
    channel: string;
    accepts?: (event: RealtimeEvent) => boolean;
    onEvent: (event: RealtimeEvent) => void;
  }): Promise<() => Promise<void>> {
    if (this.subscriptions.size >= this.options.maxConnections) {
      throw AppError.tooManyRequests('Realtime connection limit reached');
    }
    const userConnections = [...this.subscriptions.values()].filter(
      (subscription) => subscription.userId === input.userId
    ).length;
    if (userConnections >= this.options.maxConnectionsPerUser) {
      throw AppError.tooManyRequests('Realtime connection limit reached for this account');
    }

    const id = this.nextSubscriptionId++;
    let channelSubscription = this.channels.get(input.channel);
    if (!channelSubscription) {
      const releaseTransport = await this.transport.subscribe(input.channel, (event) => {
        this.receiveFromTransport(input.channel, event);
      });
      channelSubscription = { ids: new Set(), releaseTransport };
      this.channels.set(input.channel, channelSubscription);
    }
    channelSubscription.ids.add(id);
    this.subscriptions.set(id, {
      id,
      userId: input.userId,
      channel: input.channel,
      openedAt: Date.now(),
      accepts: input.accepts ?? (() => true),
      onEvent: input.onEvent,
    });
    metricsService.increment('sse_connections_opened_total');
    metricsService.setGauge('sse_active_connections', this.subscriptions.size);

    let active = true;
    return async () => {
      if (!active) return;
      active = false;
      await this.unsubscribe(id);
    };
  }

  async publish(event: RealtimeEvent): Promise<void> {
    const channels = realtimeChannels(this.options.keyPrefix, event);
    this.remember(this.locallyPublished, event.id);
    for (const channel of channels) this.deliver(channel, event);
    metricsService.increment('realtime_events_published_total');

    if (!this.transport.enabled) return;
    try {
      await this.transport.publish(channels, event);
    } catch (error) {
      metricsService.increment('redis_pubsub_errors_total');
      logger.warn(
        { eventName: event.name, errorType: error instanceof Error ? error.name : 'UnknownError' },
        'Realtime Redis publish failed; clients recover through REST'
      );
    }
  }

  queueChannel(scope: RealtimeEventScope): string {
    return queueRealtimeChannel(this.options.keyPrefix, scope);
  }

  ticketChannel(scope: RealtimeEventScope): string {
    return ticketRealtimeChannel(this.options.keyPrefix, scope);
  }

  private async unsubscribe(id: number): Promise<void> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return;
    this.subscriptions.delete(id);
    const durationSeconds = Math.max(0, (Date.now() - subscription.openedAt) / 1_000);
    metricsService.increment('sse_connections_closed_total');
    metricsService.setGauge('sse_active_connections', this.subscriptions.size);
    metricsService.setGauge('sse_connection_duration_seconds', durationSeconds);

    const channel = this.channels.get(subscription.channel);
    channel?.ids.delete(id);
    if (channel && channel.ids.size === 0) {
      this.channels.delete(subscription.channel);
      await channel.releaseTransport();
    }
  }

  private receiveFromTransport(channel: string, event: RealtimeEvent): void {
    if (this.locallyPublished.has(event.id) || this.recentlyReceived.has(event.id)) return;
    this.remember(this.recentlyReceived, event.id);
    this.deliver(channel, event);
  }

  private deliver(channel: string, event: RealtimeEvent): void {
    const subscriptionIds = this.channels.get(channel)?.ids ?? [];
    for (const id of subscriptionIds) {
      const subscription = this.subscriptions.get(id);
      if (!subscription) continue;
      if (!subscription.accepts(event)) continue;
      try {
        subscription.onEvent(event);
        metricsService.increment('sse_events_sent_total');
      } catch {
        metricsService.increment('sse_send_failures_total');
      }
    }
  }

  private remember(target: Map<string, NodeJS.Timeout>, eventId: string): void {
    if (target.size >= 10_000) {
      const oldest = target.keys().next().value as string | undefined;
      if (oldest) {
        clearTimeout(target.get(oldest));
        target.delete(oldest);
      }
    }
    const timeout = setTimeout(() => target.delete(eventId), 60_000);
    timeout.unref?.();
    target.set(eventId, timeout);
  }
}

export const realtimeHub = new RealtimeHub(realtimePubSub, {
  keyPrefix: config.redis.keyPrefix,
  maxConnections: config.realtime.maxConnections,
  maxConnectionsPerUser: config.realtime.maxConnectionsPerUser,
});
