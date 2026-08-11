import { config } from '../../../config';
import { getPaymentProvider } from '../payment-provider.registry';

describe('payment provider registry', () => {
  const paymentConfig = config.payments as { mode: 'demo' | 'external' };
  const originalMode = paymentConfig.mode;

  afterEach(() => {
    paymentConfig.mode = originalMode;
  });

  it('always selects the in-process demo provider in demo mode', () => {
    paymentConfig.mode = 'demo';

    expect(getPaymentProvider('demo').provider).toBe('demo');
    expect(getPaymentProvider('payos').provider).toBe('demo');
  });

  it('does not allow the demo provider to bypass explicitly enabled external mode', () => {
    paymentConfig.mode = 'external';

    expect(() => getPaymentProvider('demo')).toThrow(
      expect.objectContaining({ code: 'PAYMENT_PROVIDER_DISABLED', statusCode: 409 })
    );
    expect(getPaymentProvider('payos').provider).toBe('payos');
  });
});
