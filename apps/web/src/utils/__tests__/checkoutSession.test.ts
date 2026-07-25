import { beforeEach, describe, expect, it } from 'vitest';

import {
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
