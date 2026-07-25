import { AppError } from '../../utils/AppError';

export function assertPaymentTransactionUnused(orderId: string | null | undefined): void {
  if (orderId) {
    throw new AppError('Payment transaction has already been used', 409, 'PAYMENT_ALREADY_USED');
  }
}

export function resolveOrderPaymentStatus(
  hasVerifiedPayment: boolean,
  paidSubtotal: number,
  orderSubtotal: number
): 'paid' | 'unpaid' {
  return hasVerifiedPayment && paidSubtotal >= orderSubtotal ? 'paid' : 'unpaid';
}
