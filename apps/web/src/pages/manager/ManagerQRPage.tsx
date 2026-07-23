import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { get } from '../../services/apiClient';
import { buildLiffEntryUrl } from '../../services/liff/entryUrl';

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  publicQrToken: string | null;
  joinUrl: string | null;
  phone: string | null;
  address: string | null;
}

const LIFF_ID = import.meta.env.VITE_LIFF_ID as string | undefined;

export function ManagerQRPage() {
  const { t } = useTranslation(['manager', 'common']);
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch org info via authenticated endpoint
  const { data: orgData, isLoading } = useQuery<OrgInfo>({
    queryKey: ['manager-my-org'],
    queryFn: () => get<OrgInfo>('/api/v1/orgs/my-org'),
  });

  const publicJoinUrl = orgData?.publicQrToken
    ? `${window.location.origin}/qr/${orgData.publicQrToken}`
    : (orgData?.joinUrl ?? `${window.location.origin}/join/demo`);

  const liffTarget = orgData?.publicQrToken ? `/liff/qr/${orgData.publicQrToken}` : '/liff/home';
  const liffUrl = buildLiffEntryUrl(LIFF_ID, liffTarget);
  const primaryCustomerUrl = liffUrl ?? publicJoinUrl;

  function handleCopy() {
    void navigator.clipboard.writeText(primaryCustomerUrl);
  }

  function handleCopyPublicFallback() {
    void navigator.clipboard.writeText(publicJoinUrl);
  }

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<html><head><title>QR Code</title><style>
        @page{size:A4;margin:18mm}
        *{box-sizing:border-box}
        body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Arial,sans-serif;color:#111827;background:#fff}
        .print-card{width:148mm;min-height:190mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:1px solid #e5e7eb;border-radius:18px;padding:18mm}
        .store-name{font-size:22px;font-weight:800;margin:0 0 6px}
        .store-address{font-size:12px;color:#4b5563;margin:0 0 20px}
        .qr-frame{padding:18px;border:1px solid #e5e7eb;border-radius:18px}
        .caption{margin-top:18px;font-size:13px;color:#374151;font-weight:700}
      </style></head><body>${content.innerHTML}</body></html>`
    );
    w.document.close();
    w.print();
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900">{t('qr.display')}</h1>
        <p className="text-gray-400">{t('states.loading', { ns: 'common' })}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">QR</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950">{t('qr.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('qr.description')}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            {t('qr.copyPrimaryLink')}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-gray-800"
          >
            {t('actions.print', { ns: 'common' })}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[var(--shadow-soft)]">
          <div className="grid gap-0 lg:grid-cols-[360px_1fr]">
            <div className="bg-gray-950 p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#06C755]">
                {liffUrl ? t('qr.liffPrimary') : t('qr.publicFallback')}
              </p>
              <h2 className="mt-3 text-2xl font-bold">{orgData?.name ?? t('qr.storeFallback')}</h2>
              {orgData?.address && (
                <p className="mt-2 text-sm leading-6 text-gray-300">{orgData.address}</p>
              )}
              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-gray-400">
                  {liffUrl ? t('qr.liffUrl') : t('qr.publicUrl')}
                </p>
                <p className="mt-2 break-all text-sm font-semibold text-white">
                  {primaryCustomerUrl}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-6">
              <div
                ref={printRef}
                className="print-card flex w-full max-w-[340px] flex-col items-center rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm"
              >
                <p className="store-name text-lg font-extrabold text-gray-950">
                  {orgData?.name ?? t('qr.storeFallback')}
                </p>
                {orgData?.address && (
                  <p className="store-address mt-1 text-xs leading-5 text-gray-500">
                    {orgData.address}
                  </p>
                )}
                <div className="qr-frame mt-5 rounded-2xl border border-gray-100 bg-white p-4">
                  <QRCodeSVG
                    value={primaryCustomerUrl}
                    size={220}
                    fgColor={liffUrl ? '#06C755' : '#111827'}
                  />
                </div>
                <p className="caption mt-4 text-sm font-bold text-gray-700">
                  {t('qr.receptionQr')}
                </p>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[#06C755]/20 bg-white p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                  {t('qr.web')}
                </p>
                <h2 className="mt-1 font-bold text-gray-950">{t('qr.publicFallback')}</h2>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                {t('qr.development')}
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-gray-500">{t('qr.publicFallbackHint')}</p>
            <p className="mt-3 break-all rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
              {publicJoinUrl}
            </p>
            <button
              type="button"
              onClick={handleCopyPublicFallback}
              className="mt-3 w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              {t('qr.copyFallback')}
            </button>

            {!liffUrl && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                {t('qr.liffMissing')}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="font-bold text-gray-950">{t('qr.printPreview')}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">{t('qr.printHint')}</p>
            <button
              type="button"
              onClick={handlePrint}
              className="mt-4 w-full rounded-xl bg-gray-950 py-2.5 text-sm font-bold text-white hover:bg-gray-800"
            >
              {t('qr.print')}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
