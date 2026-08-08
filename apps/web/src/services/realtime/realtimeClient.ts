import {
  getAuthToken,
  refreshAuthSession,
  registerAuthTerminationListener,
  terminateAuthSession,
} from '../../store/authSession';

import { parseSseFrame } from './realtime.parser';
import {
  parseRealtimeEvent,
  type RealtimeConnectionState,
  type RealtimeEvent,
} from './realtime.types';

interface RealtimeSubscriber {
  onEvent: (event: RealtimeEvent) => void;
  onStateChange?: (state: RealtimeConnectionState) => void;
}

interface RealtimeConnection {
  endpoint: string;
  subscribers: Map<number, RealtimeSubscriber>;
  state: RealtimeConnectionState;
  controller?: AbortController;
  reconnectTimer?: ReturnType<typeof setTimeout>;
  reconnectAttempts: number;
  authRefreshAttempted: boolean;
  lastEventId?: string;
  serverRetryMs: number;
  seenEventIds: Set<string>;
}

export interface RealtimeClientDependencies {
  fetch: typeof fetch;
  getToken: () => string | null;
  refreshSession: typeof refreshAuthSession;
  terminateSession: typeof terminateAuthSession;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
}

export interface RealtimeClientOptions {
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  degradedProbeMs?: number;
  maxReconnectAttempts?: number;
  maxRememberedEventIds?: number;
}

const DEFAULT_RECONNECT_BASE_MS = 1_000;
const DEFAULT_RECONNECT_MAX_MS = 15_000;
const DEFAULT_DEGRADED_PROBE_MS = 60_000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 6;
const DEFAULT_MAX_REMEMBERED_EVENT_IDS = 256;

class RealtimeHttpError extends Error {
  constructor(readonly status: number) {
    super(`Realtime request failed with status ${status}`);
  }
}

export class RealtimeClient {
  private readonly connections = new Map<string, RealtimeConnection>();
  private nextSubscriberId = 1;
  private lifecycleAttached = false;
  private appActive = true;
  private networkOnline = true;
  private readonly options: Required<RealtimeClientOptions>;

  constructor(
    private readonly dependencies: RealtimeClientDependencies,
    options: RealtimeClientOptions = {}
  ) {
    this.options = {
      reconnectBaseMs: options.reconnectBaseMs ?? DEFAULT_RECONNECT_BASE_MS,
      reconnectMaxMs: options.reconnectMaxMs ?? DEFAULT_RECONNECT_MAX_MS,
      degradedProbeMs: options.degradedProbeMs ?? DEFAULT_DEGRADED_PROBE_MS,
      maxReconnectAttempts: options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS,
      maxRememberedEventIds: options.maxRememberedEventIds ?? DEFAULT_MAX_REMEMBERED_EVENT_IDS,
    };
  }

  subscribe(endpoint: string, subscriber: RealtimeSubscriber): () => void {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let connection = this.connections.get(normalizedEndpoint);
    if (!connection) {
      connection = {
        endpoint: normalizedEndpoint,
        subscribers: new Map(),
        state: 'idle',
        reconnectAttempts: 0,
        authRefreshAttempted: false,
        serverRetryMs: this.options.reconnectBaseMs,
        seenEventIds: new Set(),
      };
      this.connections.set(normalizedEndpoint, connection);
    }

    const subscriberId = this.nextSubscriberId++;
    connection.subscribers.set(subscriberId, subscriber);
    subscriber.onStateChange?.(connection.state);
    this.attachLifecycleListeners();
    if (!this.appActive || !this.networkOnline) this.setState(connection, 'paused');
    else this.connect(connection);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const current = this.connections.get(normalizedEndpoint);
      if (!current) return;
      current.subscribers.delete(subscriberId);
      if (current.subscribers.size === 0) this.removeConnection(current);
    };
  }

  pause(): void {
    this.appActive = false;
    for (const connection of this.connections.values()) {
      this.cancelNetworkWork(connection);
      this.setState(connection, 'paused');
    }
  }

  resume(): void {
    this.appActive = true;
    if (!this.networkOnline) return;
    for (const connection of this.connections.values()) {
      connection.reconnectAttempts = 0;
      this.connect(connection);
    }
  }

  setOnline(online: boolean): void {
    this.networkOnline = online;
    if (!online) {
      for (const connection of this.connections.values()) {
        this.cancelNetworkWork(connection);
        this.setState(connection, 'paused');
      }
      return;
    }
    if (this.appActive) this.resume();
  }

  closeAll(): void {
    for (const connection of [...this.connections.values()]) this.removeConnection(connection);
    this.detachLifecycleListeners();
  }

  private connect(connection: RealtimeConnection): void {
    if (
      connection.subscribers.size === 0 ||
      connection.controller ||
      connection.reconnectTimer ||
      !this.appActive ||
      !this.networkOnline
    ) {
      return;
    }
    const token = this.dependencies.getToken();
    if (!token) {
      this.setState(connection, 'degraded');
      return;
    }

    const controller = new AbortController();
    connection.controller = controller;
    this.setState(connection, connection.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    void this.open(connection, controller, token)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof RealtimeHttpError && [403, 404, 422].includes(error.status)) {
          this.setState(connection, 'degraded');
          return;
        }
        this.scheduleReconnect(connection);
      })
      .finally(() => {
        if (connection.controller === controller) connection.controller = undefined;
      });
  }

  private async open(
    connection: RealtimeConnection,
    controller: AbortController,
    token: string
  ): Promise<void> {
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
      'Accept-Language': document.documentElement.lang || 'ja',
    };
    if (connection.lastEventId) headers['Last-Event-ID'] = connection.lastEventId;

    const response = await this.dependencies.fetch(resolveApiUrl(connection.endpoint), {
      method: 'GET',
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (response.status === 401) {
      await this.handleUnauthorized(connection);
      return;
    }
    if (!response.ok || !response.body) throw new RealtimeHttpError(response.status);

    connection.authRefreshAttempted = false;
    this.setState(connection, 'connected');
    await this.consumeStream(connection, response.body, controller.signal);
    if (!controller.signal.aborted) throw new Error('Realtime stream ended');
  }

  private async handleUnauthorized(connection: RealtimeConnection): Promise<void> {
    if (connection.authRefreshAttempted) {
      await this.dependencies.terminateSession();
      return;
    }
    connection.authRefreshAttempted = true;
    try {
      await this.dependencies.refreshSession();
      this.dependencies.setTimeout(() => this.connect(connection), 0);
    } catch {
      await this.dependencies.terminateSession();
    }
  }

  private async consumeStream(
    connection: RealtimeConnection,
    stream: ReadableStream<Uint8Array>,
    signal: AbortSignal
  ): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const shouldClose = this.consumeFrame(connection, frame);
          if (shouldClose) return;
          boundary = buffer.indexOf('\n\n');
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) this.consumeFrame(connection, buffer);
    } finally {
      reader.releaseLock();
    }
  }

  private consumeFrame(connection: RealtimeConnection, frame: string): boolean {
    const parsed = parseSseFrame(frame);
    if (!parsed) return false;
    if (parsed.retryMs !== undefined) {
      connection.serverRetryMs = Math.min(
        this.options.reconnectMaxMs,
        Math.max(this.options.reconnectBaseMs, parsed.retryMs)
      );
    }
    if (parsed.event === 'stream.closed') return true;
    if (!parsed.data) return false;

    const event = parseRealtimeEvent(parsed.data);
    if (!event || (parsed.event && parsed.event !== event.name)) return false;
    if (connection.seenEventIds.has(event.id)) return false;

    connection.lastEventId = parsed.id ?? event.id;
    connection.reconnectAttempts = 0;
    rememberEventId(connection.seenEventIds, event.id, this.options.maxRememberedEventIds);
    for (const subscriber of connection.subscribers.values()) {
      try {
        subscriber.onEvent(event);
      } catch {
        // One consumer must not interrupt delivery to other subscribers.
      }
    }
    return false;
  }

  private scheduleReconnect(connection: RealtimeConnection): void {
    if (
      connection.subscribers.size === 0 ||
      connection.reconnectTimer ||
      !this.appActive ||
      !this.networkOnline
    ) {
      return;
    }
    connection.reconnectAttempts += 1;
    const exhausted = connection.reconnectAttempts >= this.options.maxReconnectAttempts;
    const exponentialDelay = Math.min(
      this.options.reconnectMaxMs,
      connection.serverRetryMs * 2 ** Math.max(0, connection.reconnectAttempts - 1)
    );
    const delay = exhausted ? this.options.degradedProbeMs : exponentialDelay;
    this.setState(connection, exhausted ? 'degraded' : 'reconnecting');
    connection.reconnectTimer = this.dependencies.setTimeout(() => {
      connection.reconnectTimer = undefined;
      this.connect(connection);
    }, delay);
  }

  private setState(connection: RealtimeConnection, state: RealtimeConnectionState): void {
    if (connection.state === state) return;
    connection.state = state;
    for (const subscriber of connection.subscribers.values()) {
      subscriber.onStateChange?.(state);
    }
  }

  private removeConnection(connection: RealtimeConnection): void {
    this.cancelNetworkWork(connection);
    connection.subscribers.clear();
    this.connections.delete(connection.endpoint);
    if (this.connections.size === 0) this.detachLifecycleListeners();
  }

  private cancelNetworkWork(connection: RealtimeConnection): void {
    connection.controller?.abort();
    connection.controller = undefined;
    if (connection.reconnectTimer) {
      this.dependencies.clearTimeout(connection.reconnectTimer);
      connection.reconnectTimer = undefined;
    }
  }

  private readonly handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') this.pause();
    else this.resume();
  };

  private readonly handleOnline = () => this.setOnline(true);
  private readonly handleOffline = () => this.setOnline(false);

  private attachLifecycleListeners(): void {
    if (this.lifecycleAttached) return;
    this.lifecycleAttached = true;
    this.appActive = document.visibilityState !== 'hidden';
    this.networkOnline = navigator.onLine !== false;
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private detachLifecycleListeners(): void {
    if (!this.lifecycleAttached) return;
    this.lifecycleAttached = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }
}

function resolveApiUrl(endpoint: string): string {
  const baseUrl = String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  return `${baseUrl}${endpoint}`;
}

function rememberEventId(ids: Set<string>, eventId: string, limit: number): void {
  ids.add(eventId);
  if (ids.size <= limit) return;
  const oldest = ids.values().next().value as string | undefined;
  if (oldest) ids.delete(oldest);
}

const defaultDependencies: RealtimeClientDependencies = {
  fetch: (input, init) => globalThis.fetch(input, init),
  getToken: getAuthToken,
  refreshSession: refreshAuthSession,
  terminateSession: terminateAuthSession,
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
};

export const realtimeClient = new RealtimeClient(defaultDependencies);

registerAuthTerminationListener(() => realtimeClient.closeAll());
