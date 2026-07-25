import { resolveOrderPaymentStatus } from '../orders.payment';

describe('order payment summary', () => {
  it('marks an order paid when verified required-item coverage also covers the full cart', () => {
    expect(resolveOrderPaymentStatus(true, 1500, 1500)).toBe('paid');
  });

  it('keeps an order unpaid while a balance remains', () => {
    expect(resolveOrderPaymentStatus(true, 1500, 2000)).toBe('unpaid');
  });

  it('does not mark a free order paid without a verified payment', () => {
    expect(resolveOrderPaymentStatus(false, 0, 0)).toBe('unpaid');
  });
});
