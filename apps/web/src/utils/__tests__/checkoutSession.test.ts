import { beforeEach, describe, expect, it } from 'vitest';

import {
  appendBookingRecord,
  BOOKING_GROUP_PREFIX,
  CHECKOUT_DRAFT_PREFIX,
  CHECKOUT_SESSION_PREFIX,
  clearCheckoutDraft,
  clearCheckoutSession,
  clearPaidCheckout,
  PAID_CHECKOUT_PREFIX,
} from '../checkoutSession';

describe('checkout session cleanup', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('removes only the completed booking attempt state', () => {
    sessionStorage.setItem(`${CHECKOUT_SESSION_PREFIX}session-1`, '{}');
    sessionStorage.setItem(`${CHECKOUT_DRAFT_PREFIX}draft-1`, '{}');
    sessionStorage.setItem(`${PAID_CHECKOUT_PREFIX}payment-1`, '{}');
    sessionStorage.setItem(`${CHECKOUT_DRAFT_PREFIX}draft-2`, '{"kept":true}');

    clearCheckoutSession('session-1');
    clearCheckoutDraft('draft-1');
    clearPaidCheckout('payment-1');

    expect(sessionStorage.getItem(`${CHECKOUT_SESSION_PREFIX}session-1`)).toBeNull();
    expect(sessionStorage.getItem(`${CHECKOUT_DRAFT_PREFIX}draft-1`)).toBeNull();
    expect(sessionStorage.getItem(`${PAID_CHECKOUT_PREFIX}payment-1`)).toBeNull();
    expect(sessionStorage.getItem(`${CHECKOUT_DRAFT_PREFIX}draft-2`)).toBe('{"kept":true}');
  });
});

describe('booking record aggregation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('replaces the same active queue entry and combines its local item summary', () => {
    const base = {
      orderId: 'order-1',
      queueEntryId: 'entry-1',
      ticketPath: '/liff/tickets/entry-1',
      createdAt: '2026-07-28T00:00:00.000Z',
      subtotal: 1000,
      items: [
        {
          productId: 'product-1',
          name: 'Service',
          imageUrl: null,
          quantity: 1,
          unitPrice: 1000,
          subtotal: 1000,
          requiresPrepayment: false,
        },
      ],
    };

    appendBookingRecord(
      'liff:qr:test',
      { orgSlug: 'test', localDeviceKey: 'device-1', groupId: 'group-1' },
      base
    );
    const result = appendBookingRecord(
      'liff:qr:test',
      { orgSlug: 'test', localDeviceKey: 'device-1', groupId: 'group-1' },
      {
        ...base,
        createdAt: '2026-07-28T01:00:00.000Z',
        subtotal: 2000,
      }
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      queueEntryId: 'entry-1',
      createdAt: base.createdAt,
      subtotal: 2000,
      items: [{ productId: 'product-1', quantity: 2, subtotal: 2000 }],
    });
    expect(localStorage.getItem(`${BOOKING_GROUP_PREFIX}liff:qr:test`)).not.toBeNull();
  });
});
