import {
  createRealtimeEvent,
  parseRealtimeEvent,
  queueRealtimeChannel,
  realtimeChannels,
  ticketRealtimeChannel,
} from '../realtime.contract';

const scope = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  branchId: '22222222-2222-4222-8222-222222222222',
  queueId: '33333333-3333-4333-8333-333333333333',
  ticketId: '44444444-4444-4444-8444-444444444444',
};

describe('realtime event contract', () => {
  it('creates a versioned minimal event and tenant-scoped channels', () => {
    const event = createRealtimeEvent({
      name: 'ticket.called',
      scope,
      payload: { status: 'called', aheadCount: 0 },
    });

    expect(event).toMatchObject({ name: 'ticket.called', version: 1, scope });
    expect(Object.keys(event.payload).sort()).toEqual(['aheadCount', 'status']);
    expect(realtimeChannels('sqa', event)).toEqual([
      queueRealtimeChannel('sqa', scope),
      ticketRealtimeChannel('sqa', scope),
    ]);
  });

  it('rejects unknown payload fields so PII cannot leak through the contract', () => {
    const raw = JSON.stringify({
      id: '55555555-5555-4555-8555-555555555555',
      name: 'ticket.called',
      version: 1,
      occurredAt: '2026-08-08T00:00:00.000Z',
      scope,
      payload: { status: 'called', email: 'customer@example.com' },
    });

    expect(parseRealtimeEvent(raw)).toBeNull();
  });
});
