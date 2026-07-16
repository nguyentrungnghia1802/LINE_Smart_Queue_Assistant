import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import { LanguageSwitcher } from '../components/i18n/LanguageSwitcher';
import { post } from '../services/apiClient';
import {
  formatJPY,
  loadCheckoutSession,
  paymentKeyFor,
  savePaidCheckout,
} from '../utils/checkoutSession';
import {
  isExternalPaymentConfigured,
  PAYMENT_METHODS,
  type PaymentGatewayMethod,
} from '../utils/paymentGateway';

interface PaymentIntentResponse {
  transactionId: string;
  provider: string;
  method: string;
  status: string;
  amount: number;
  currency: string;
  checkoutUrl: string | null;
  demoToken?: string;
  coveredProductIds: string[];
  scope: 'required_items' | 'all_items';
}

interface PaymentStatusResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  scope: 'required_items' | 'all_items';
  coveredProductIds: string[];
}

export function PaymentDemoPage() {
  const { t } = useTranslation(['customer', 'common']);
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const session = useMemo(() => loadCheckoutSession(sessionId), [sessionId]);
  const [paymentScope, setPaymentScope] = useState<'required_items' | 'all_items'>(
    session?.scope ?? 'required_items'
  );
  const [method, setMethod] = useState(session?.preferredMethod ?? PAYMENT_METHODS[0].id);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const externalPaymentReady = isExternalPaymentConfigured();

  if (!session) return <Navigate to="/" replace />;

  const selectedMethod = PAYMENT_METHODS.find((item) => item.id === method) ?? PAYMENT_METHODS[0];
  const requiredProductIds =
    session.requiredProductIds ??
    (session.scope === 'required_items'
      ? session.coveredProductIds
      : session.items.filter((item) => item.requiresPrepayment).map((item) => item.productId));
  const requiredItems = session.items.filter((item) => requiredProductIds.includes(item.productId));
  const payableItems = paymentScope === 'all_items' ? session.items : requiredItems;
  const payableSubtotal = payableItems.reduce((sum, item) => sum + item.subtotal, 0);
  const canChooseScope = requiredItems.length > 0 && session.items.length > requiredItems.length;

  async function completePayment() {
    if (!session) return;
    setProcessing(true);
    setError('');
    try {
      const intent = await post<PaymentIntentResponse>('/api/v1/payments/intents', {
        orgSlug: session.orgSlug,
        items: session.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        scope: paymentScope,
        provider: externalPaymentReady ? selectedMethod.provider : 'demo',
        method: selectedMethod.externalMethod ?? selectedMethod.id,
        currency: 'JPY',
        returnUrl: window.location.href,
        cartSignature: session.cartSignature,
      });

      if (intent.checkoutUrl) {
        window.location.assign(intent.checkoutUrl);
        return;
      }

      if (!intent.demoToken) {
        throw new Error(t('payment.failed', { ns: 'customer' }));
      }

      const confirmed = await post<PaymentStatusResponse>('/api/v1/payments/demo/complete', {
        transactionId: intent.transactionId,
        demoToken: intent.demoToken,
      });

      if (confirmed.status !== 'paid') {
        throw new Error(t('payment.failed', { ns: 'customer' }));
      }

      const paymentKey = session.paymentKeyBase
        ? paymentKeyFor(session.paymentKeyBase, paymentScope)
        : session.paymentKey;
      savePaidCheckout(paymentKey, {
        paid: true,
        transactionId: confirmed.id,
        method,
        code: confirmed.id,
        amount: confirmed.amount,
        scope: paymentScope,
        coveredProductIds: confirmed.coveredProductIds,
        cartSignature: session.cartSignature,
        paidAt: new Date().toISOString(),
      });
      navigate(session.returnPath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('payment.failed', { ns: 'customer' }));
      setProcessing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--app-bg)] px-4 py-6">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                {externalPaymentReady
                  ? t('payment.title', { ns: 'customer' })
                  : t('payment.demo', { ns: 'customer' })}
              </p>
              <h1 className="mt-2 text-2xl font-bold text-gray-950">
                {t('payment.title', { ns: 'customer' })}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('payment.organizationPrepayment', { ns: 'customer', name: session.orgName })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher compact />
              <Link
                to={session.returnPath}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                {t('actions.back', { ns: 'common' })}
              </Link>
            </div>
          </div>

          {canChooseScope && (
            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setPaymentScope('required_items')}
                className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                  paymentScope === 'required_items'
                    ? 'bg-white text-gray-950 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {t('payment.requiredOnly', { ns: 'customer' })}
              </button>
              <button
                type="button"
                onClick={() => setPaymentScope('all_items')}
                className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                  paymentScope === 'all_items'
                    ? 'bg-white text-gray-950 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {t('payment.fullAmount', { ns: 'customer' })}
              </button>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {payableItems.map((item) => (
              <div
                key={item.productId}
                className="grid grid-cols-[56px_1fr_auto] gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white text-sm font-semibold text-gray-500">
                    {item.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{item.name}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {formatJPY(item.unitPrice)} x {item.quantity}
                  </p>
                </div>
                <p className="self-center text-sm font-bold text-gray-950">
                  {formatJPY(item.subtotal)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-gray-950 p-4 text-white">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">
                {paymentScope === 'all_items'
                  ? t('payment.total', { ns: 'customer' })
                  : t('payment.requiredTotal', { ns: 'customer' })}
              </span>
              <span className="text-2xl font-bold">{formatJPY(payableSubtotal)}</span>
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-sm font-semibold text-gray-950">
            {t('payment.method', { ns: 'customer' })}
          </h2>
          <div className="mt-4 space-y-2">
            {PAYMENT_METHODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMethod(item.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  method === item.id
                    ? 'border-brand-500 bg-brand-50 text-brand-800'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="block text-sm font-semibold">{t(item.labelKey)}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{t(item.descriptionKey)}</span>
              </button>
            ))}
          </div>

          <PaymentFields method={selectedMethod.id} />

          <button
            type="button"
            onClick={completePayment}
            disabled={processing}
            className="mt-5 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {processing ? t('payment.processing', { ns: 'customer' }) : t(selectedMethod.labelKey)}
          </button>
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <p className="mt-3 text-xs leading-5 text-gray-500">
            {externalPaymentReady
              ? t('payment.externalHint', { ns: 'customer' })
              : t('payment.demoHint', { ns: 'customer' })}
          </p>
        </aside>
      </div>
    </main>
  );
}

function PaymentFields({ method }: Readonly<{ method: PaymentGatewayMethod['id'] }>) {
  const { t } = useTranslation('customer');
  if (method === 'credit_card') {
    return (
      <div className="mt-5 space-y-3">
        <TextInput
          label={t('payment.cardNumber', { ns: 'customer' })}
          value="4242 4242 4242 4242"
        />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label={t('payment.expiry', { ns: 'customer' })} value="12 / 30" />
          <TextInput label="CVC" value="123" />
        </div>
      </div>
    );
  }

  if (method === 'konbini') {
    return (
      <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        {t('payment.convenienceHint', { ns: 'customer' })}
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
      {t('payment.appHint', { ns: 'customer' })}
    </div>
  );
}

function TextInput({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <input
        value={value}
        readOnly
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
      />
    </label>
  );
}
