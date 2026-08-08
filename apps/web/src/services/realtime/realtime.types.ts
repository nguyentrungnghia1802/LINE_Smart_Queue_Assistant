export const realtimeEventNames = [
  'ticket.created',
  'ticket.called',
  'ticket.serving',
  'ticket.completed',
  'ticket.cancelled',
  'ticket.deferred',
  'ticket.no_show',
  'ticket.eta_updated',
  'queue.summary_updated',
] as const;

export type RealtimeEventName = (typeof realtimeEventNames)[number];
export type RealtimeConnectionState =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'degraded' | 'paused';

export interface RealtimeEvent {
  id: string;
  name: RealtimeEventName;
  version: 1;
  occurredAt: string;
  scope: {
    organizationId: string;
    branchId: string;
    queueId: string;
    ticketId?: string;
  };
  payload: {
    status?: string;
    aheadCount?: number;
    estimatedWaitSeconds?: number | null;
    reason?: string;
  };
}

const eventNameSet = new Set<string>(realtimeEventNames);
const scopeKeys = new Set(['organizationId', 'branchId', 'queueId', 'ticketId']);
const payloadKeys = new Set(['status', 'aheadCount', 'estimatedWaitSeconds', 'reason']);

export function parseRealtimeEvent(value: string): RealtimeEvent | null {
  try {
    const candidate: unknown = JSON.parse(value);
    if (
      !isRecord(candidate) ||
      !hasOnlyKeys(candidate, ['id', 'name', 'version', 'occurredAt', 'scope', 'payload'])
    ) {
      return null;
    }
    if (
      typeof candidate.id !== 'string' ||
      !eventNameSet.has(String(candidate.name)) ||
      candidate.version !== 1 ||
      typeof candidate.occurredAt !== 'string' ||
      !isRecord(candidate.scope) ||
      !isRecord(candidate.payload) ||
      !hasOnlyKeys(candidate.scope, scopeKeys) ||
      !hasOnlyKeys(candidate.payload, payloadKeys)
    ) {
      return null;
    }
    const scope = candidate.scope;
    if (
      typeof scope.organizationId !== 'string' ||
      typeof scope.branchId !== 'string' ||
      typeof scope.queueId !== 'string' ||
      (scope.ticketId !== undefined && typeof scope.ticketId !== 'string')
    ) {
      return null;
    }
    const payload = candidate.payload;
    if (
      (payload.status !== undefined && typeof payload.status !== 'string') ||
      (payload.aheadCount !== undefined && !isNonNegativeInteger(payload.aheadCount)) ||
      (payload.estimatedWaitSeconds !== undefined &&
        payload.estimatedWaitSeconds !== null &&
        !isNonNegativeInteger(payload.estimatedWaitSeconds)) ||
      (payload.reason !== undefined && typeof payload.reason !== 'string')
    ) {
      return null;
    }
    return candidate as unknown as RealtimeEvent;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: Iterable<string>): boolean {
  const allowedKeys = allowed instanceof Set ? allowed : new Set(allowed);
  return Object.keys(record).every((key) => allowedKeys.has(key));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
