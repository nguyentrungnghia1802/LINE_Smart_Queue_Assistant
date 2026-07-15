import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import {
  formatJPY,
  loadCheckoutSession,
  paymentKeyFor,
  savePaidCheckout,
} from '../utils/checkoutSession';
import {
  createPaymentIntent,
  isExternalPaymentConfigured,
  PAYMENT_METHODS,
  type PaymentGatewayMethod,
} from '../utils/paymentGateway';

export function PaymentDemoPage() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const session = useMemo(() => loadCheckoutSession(sessionId), [sessionId]);
  const [paymentScope, setPaymentScope] = useState<'required_items' | 'all_items'>(
    session?.scope ?? 'required_items'
  );
  const [method, setMethod] = useState(session?.preferredMethod ?? PAYMENT_METHODS[0].id);
  const [processing, setProcessing] = useState(false);
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
  const coveredProductIds =
    paymentScope === 'all_items' ? session.items.map((item) => item.productId) : requiredProductIds;

  function completePayment() {
    if (!session) return;
    setProcessing(true);
    const intent = createPaymentIntent({
      session,
      method: selectedMethod,
      amount: payableSubtotal,
      scope: paymentScope,
      returnUrl: window.location.href,
    });

    if (intent.redirectUrl) {
      window.location.assign(intent.redirectUrl);
      return;
    }

    window.setTimeout(() => {
      const paymentKey = session.paymentKeyBase
        ? paymentKeyFor(session.paymentKeyBase, paymentScope)
        : session.paymentKey;
      savePaidCheckout(paymentKey, {
        paid: true,
        method,
        code: intent.transactionId,
        amount: payableSubtotal,
        scope: paymentScope,
        coveredProductIds,
        cartSignature: session.cartSignature,
        paidAt: new Date().toISOString(),
      });
      navigate(session.returnPath, { replace: true });
    }, 700);
  }

  return (
    <main className="min-h-screen bg-[var(--app-bg)] px-4 py-6">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                {externalPaymentReady ? 'オンライン決済' : 'デモ決済'}
              </p>
              <h1 className="mt-2 text-2xl font-bold text-gray-950">お支払い</h1>
              <p className="mt-1 text-sm text-gray-500">
                {session.orgName} の事前支払いを処理します。
              </p>
            </div>
            <Link
              to={session.returnPath}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              戻る
            </Link>
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
                必須分のみ
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
                全額支払い
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
                {paymentScope === 'all_items' ? 'お支払い合計' : '事前支払い合計'}
              </span>
              <span className="text-2xl font-bold">{formatJPY(payableSubtotal)}</span>
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-sm font-semibold text-gray-950">支払い方法</h2>
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
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{item.description}</span>
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
            {processing ? '処理中...' : `${selectedMethod.label}で支払う`}
          </button>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            {externalPaymentReady
              ? '外部決済ページへ移動して支払いを完了します。'
              : '決済会社の契約・APIキーが未設定のため、デモ決済として自動で成功します。'}
          </p>
        </aside>
      </div>
    </main>
  );
}

function PaymentFields({ method }: Readonly<{ method: PaymentGatewayMethod['id'] }>) {
  if (method === 'credit_card') {
    return (
      <div className="mt-5 space-y-3">
        <TextInput label="カード番号" value="4242 4242 4242 4242" />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="有効期限" value="12 / 30" />
          <TextInput label="CVC" value="123" />
        </div>
      </div>
    );
  }

  if (method === 'konbini') {
    return (
      <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        コンビニ支払い番号を発行します。デモでは発行後すぐに支払い完了になります。
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
      外部アプリへ移動する想定の画面です。デモではこの画面で支払い完了になります。
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
