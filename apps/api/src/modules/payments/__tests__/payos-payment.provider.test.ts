import { createHmac } from 'node:crypto';

jest.mock('../../../config', () => ({
  config: {
    payments: {
      externalRedirectBaseUrl: 'https://queue.example.com',
      payos: {
        clientId: 'client-id',
        apiKey: 'api-key',
        checksumKey: 'checksum-key',
      },
    },
  },
}));

import { PayosPaymentProvider } from '../providers/payos-payment.provider';

const fetchMock = jest.fn();
global.fetch = fetchMock as typeof fetch;

describe('PayosPaymentProvider', () => {
  beforeEach(() => fetchMock.mockReset());

  it('creates a pending VND checkout without exposing credentials', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '00',
        desc: 'success',
        data: {
          paymentLinkId: 'payos-link-1',
          checkoutUrl: 'https://pay.payos.vn/web/payos-link-1',
          qrCode: 'vietqr-payload',
          status: 'PENDING',
        },
      }),
    });

    const result = await new PayosPaymentProvider().createPaymentIntent({
      transactionId: '11111111-1111-4111-8111-111111111111',
      amount: 150_000,
      currency: 'VND',
      method: 'vietqr',
      returnUrl: 'https://queue.example.com/liff/checkout/return',
      metadata: {
        orgSlug: 'example',
        scope: 'all_items',
        coveredProductIds: [],
        items: [],
      },
    });

    expect(result).toMatchObject({
      providerIntentId: 'payos-link-1',
      checkoutUrl: 'https://pay.payos.vn/web/payos-link-1',
      status: 'pending',
    });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.headers).toMatchObject({
      'x-client-id': 'client-id',
      'x-api-key': 'api-key',
    });
    expect(JSON.stringify(result)).not.toContain('checksum-key');
  });

  it('verifies and parses a signed paid webhook', () => {
    const data = {
      amount: 150000,
      code: '00',
      paymentLinkId: 'payos-link-1',
      reference: 'bank-reference-1',
    };
    const signatureData = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key as keyof typeof data]}`)
      .join('&');
    const signature = createHmac('sha256', 'checksum-key').update(signatureData).digest('hex');
    const rawBody = Buffer.from(JSON.stringify({ success: true, data, signature }));
    const provider = new PayosPaymentProvider();

    expect(provider.verifyWebhookSignature(rawBody, {})).toBe(true);
    expect(provider.parseWebhookPayload(rawBody)).toMatchObject({
      providerIntentId: 'payos-link-1',
      status: 'paid',
      eventId: 'payos-link-1:bank-reference-1',
    });
  });
});
