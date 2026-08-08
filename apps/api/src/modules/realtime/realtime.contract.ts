import { randomUUID } from 'node:crypto';

import { z } from 'zod';

export const REALTIME_EVENT_VERSION = 1 as const;

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

const realtimeEventSchema = z
  .object({
    id: z.string().uuid(),
    name: z.enum(realtimeEventNames),
    version: z.literal(REALTIME_EVENT_VERSION),
    occurredAt: z.string().datetime(),
    scope: z
      .object({
        organizationId: z.string().uuid(),
        branchId: z.string().uuid(),
        queueId: z.string().uuid(),
        ticketId: z.string().uuid().optional(),
      })
      .strict(),
    payload: z
      .object({
        status: z.string().min(1).max(32).optional(),
        aheadCount: z.number().int().min(0).optional(),
        estimatedWaitSeconds: z.number().int().min(0).nullable().optional(),
        reason: z.string().min(1).max(64).optional(),
      })
      .strict(),
  })
  .strict();

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
export type RealtimeEventScope = RealtimeEvent['scope'];
export type RealtimeEventPayload = RealtimeEvent['payload'];

export function createRealtimeEvent(input: {
  name: RealtimeEventName;
  scope: RealtimeEventScope;
  payload?: RealtimeEventPayload;
  id?: string;
  occurredAt?: string;
}): RealtimeEvent {
  return realtimeEventSchema.parse({
    id: input.id ?? randomUUID(),
    name: input.name,
    version: REALTIME_EVENT_VERSION,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    scope: input.scope,
    payload: input.payload ?? {},
  });
}

export function parseRealtimeEvent(value: string): RealtimeEvent | null {
  try {
    const parsed: unknown = JSON.parse(value);
    const result = realtimeEventSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function scopedPrefix(prefix: string, scope: RealtimeEventScope): string {
  return `${prefix}:realtime:v1:org:${scope.organizationId}:branch:${scope.branchId}`;
}

export function queueRealtimeChannel(prefix: string, scope: RealtimeEventScope): string {
  return `${scopedPrefix(prefix, scope)}:queue:${scope.queueId}`;
}

export function ticketRealtimeChannel(prefix: string, scope: RealtimeEventScope): string {
  if (!scope.ticketId) throw new Error('Ticket-scoped realtime event requires ticketId');
  return `${queueRealtimeChannel(prefix, scope)}:ticket:${scope.ticketId}`;
}

export function realtimeChannels(prefix: string, event: RealtimeEvent): string[] {
  const channels = [queueRealtimeChannel(prefix, event.scope)];
  if (event.scope.ticketId) channels.push(ticketRealtimeChannel(prefix, event.scope));
  return channels;
}
