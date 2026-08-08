import { describe, expect, it } from 'vitest';

import { parseSseFrame } from '../realtime.parser';
import { parseRealtimeEvent } from '../realtime.types';

const validEvent = {
  id: 'event-1',
  name: 'ticket.called',
  version: 1,
  occurredAt: '2026-08-08T00:00:00.000Z',
  scope: {
    organizationId: 'org-1',
    branchId: 'branch-1',
    queueId: 'queue-1',
    ticketId: 'ticket-1',
  },
  payload: {
    status: 'called',
    aheadCount: 0,
    estimatedWaitSeconds: 0,
  },
};

describe('realtime SSE parsing', () => {
  it('parses standard fields, comments, multiline data, and retry hints', () => {
    expect(
      parseSseFrame(
        ': heartbeat\r\nid: event-1\r\nevent: ticket.called\r\nretry: 2500\r\ndata: {"one":\r\ndata: "two"}'
      )
    ).toEqual({
      id: 'event-1',
      event: 'ticket.called',
      retryMs: 2500,
      data: '{"one":\n"two"}',
    });
  });

  it('accepts the minimal versioned event contract', () => {
    expect(parseRealtimeEvent(JSON.stringify(validEvent))).toEqual(validEvent);
  });

  it('rejects unknown or sensitive fields instead of exposing them to consumers', () => {
    expect(
      parseRealtimeEvent(
        JSON.stringify({
          ...validEvent,
          payload: { ...validEvent.payload, customerPhone: '09000000000' },
        })
      )
    ).toBeNull();
    expect(
      parseRealtimeEvent(
        JSON.stringify({
          ...validEvent,
          scope: { ...validEvent.scope, lineUserId: 'U-secret' },
        })
      )
    ).toBeNull();
  });

  it('rejects malformed values and unsupported event versions', () => {
    expect(parseRealtimeEvent('{')).toBeNull();
    expect(parseRealtimeEvent(JSON.stringify({ ...validEvent, version: 2 }))).toBeNull();
    expect(
      parseRealtimeEvent(
        JSON.stringify({ ...validEvent, payload: { ...validEvent.payload, aheadCount: -1 } })
      )
    ).toBeNull();
  });
});
