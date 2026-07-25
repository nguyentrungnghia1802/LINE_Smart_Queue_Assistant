export function resolveOrderPaymentStatus(
  hasVerifiedPayment: boolean,
  paidSubtotal: number,
  orderSubtotal: number
): 'paid' | 'unpaid' {
  return hasVerifiedPayment && paidSubtotal >= orderSubtotal ? 'paid' : 'unpaid';
}
