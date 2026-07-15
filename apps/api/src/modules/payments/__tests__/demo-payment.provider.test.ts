import { createHmac } from 'node:crypto';

import { config } from '../../../config';
import { DemoPaymentProvider } from '../providers/demo-payment.provider';

const provider = new DemoPaymentProvider();

describe('DemoPaymentProvider', () => {
  it('creates a pending demo payment intent with a completion token', async () => {
    const intent = await provider.createPaymentIntent({
      transactionId: '11111111-1111-4111-8111-111111111111',
      amount: 1200,
      currency: 'JPY',
      method: 'credit_card',
      metadata: {
        orgSlug: 'demo',
        scope: 'required_items',
        coveredProductIds: ['44444444-4444-4444-8444-444444444441'],
        items: [],
      },
    });

    expect(intent.status).toBe('pending');
    expect(intent.checkoutUrl).toBeNull();
    expect(intent.providerIntentId).toContain('demo_pi_');
    expect(intent.demoToken).toHaveLength(64);
  });

  it('verifies and parses demo webhook payloads', () => {
    const body = Buffer.from(
      JSON.stringify({
        eventId: 'evt_demo_paid_001',
        eventType: 'demo.payment.paid',
        transactionId: '11111111-1111-4111-8111-111111111111',
        status: 'paid',
      })
    );
    const signature = createHmac('sha256', config.payments.demoWebhookSecret)
      .update(body)
      .digest('hex');

    expect(provider.verifyWebhookSignature(body, { 'x-demo-payment-signature': signature })).toBe(
      true
    );
    const event = provider.parseWebhookPayload(body);
    expect(event.eventId).toBe('evt_demo_paid_001');
    expect(event.status).toBe('paid');
  });
});
