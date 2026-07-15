import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useRef } from 'react';

import { get } from '../../services/apiClient';

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
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch org info via authenticated endpoint
  const { data: orgData, isLoading } = useQuery<OrgInfo>({
    queryKey: ['manager-my-org'],
    queryFn: () => get<OrgInfo>('/api/v1/orgs/my-org'),
  });

  const joinUrl =
    orgData?.joinUrl ??
    (orgData?.publicQrToken
      ? `${window.location.origin}/qr/${orgData.publicQrToken}`
      : `${window.location.origin}/join/demo`);

  const liffTarget = orgData?.publicQrToken ? `/liff/qr/${orgData.publicQrToken}` : '/liff/home';
  const liffUrl = LIFF_ID
    ? `https://liff.line.me/${LIFF_ID}?liff.state=${encodeURIComponent(liffTarget)}`
    : null;

  function handleCopy() {
    void navigator.clipboard.writeText(joinUrl ?? '');
  }

  function handleCopyLiff() {
    if (liffUrl) void navigator.clipboard.writeText(liffUrl);
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
        <h1 className="text-xl font-bold text-gray-900">QRコード表示</h1>
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">QR</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950">QRコード</h1>
          <p className="mt-1 text-sm text-gray-500">受付リンクとLINE導線を管理します。</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            リンクをコピー
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-gray-800"
          >
            印刷
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[var(--shadow-soft)]">
          <div className="grid gap-0 lg:grid-cols-[360px_1fr]">
            <div className="bg-gray-950 p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#06C755]">
                Public QR
              </p>
              <h2 className="mt-3 text-2xl font-bold">{orgData?.name ?? '店舗'}</h2>
              {orgData?.address && (
                <p className="mt-2 text-sm leading-6 text-gray-300">{orgData.address}</p>
              )}
              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-gray-400">公開受付URL</p>
                <p className="mt-2 break-all text-sm font-semibold text-white">{joinUrl}</p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-6">
              <div
                ref={printRef}
                className="print-card flex w-full max-w-[340px] flex-col items-center rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm"
              >
                <p className="store-name text-lg font-extrabold text-gray-950">
                  {orgData?.name ?? '店舗'}
                </p>
                {orgData?.address && (
                  <p className="store-address mt-1 text-xs leading-5 text-gray-500">
                    {orgData.address}
                  </p>
                )}
                <div className="qr-frame mt-5 rounded-2xl border border-gray-100 bg-white p-4">
                  <QRCodeSVG value={joinUrl} size={220} />
                </div>
                <p className="caption mt-4 text-sm font-bold text-gray-700">受付QRコード</p>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[#06C755]/20 bg-white p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#06C755]">
                  LINE
                </p>
                <h2 className="mt-1 font-bold text-gray-950">LIFF QR</h2>
              </div>
              <span className="rounded-full bg-[#06C755]/10 px-2.5 py-1 text-xs font-bold text-[#048b3b]">
                {liffUrl ? '有効' : '未設定'}
              </span>
            </div>

            {liffUrl ? (
              <div className="mt-5 flex flex-col items-center">
                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <QRCodeSVG value={liffUrl} size={180} fgColor="#06C755" />
                </div>
                <p className="mt-4 w-full break-all rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  {liffUrl}
                </p>
                <button
                  type="button"
                  onClick={handleCopyLiff}
                  className="mt-3 w-full rounded-xl bg-[#06C755] py-2.5 text-sm font-bold text-white hover:bg-[#05b54c]"
                >
                  LIFFリンクをコピー
                </button>
              </div>
            ) : (
              <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                VITE_LIFF_ID 未設定
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="font-bold text-gray-950">印刷プレビュー</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              印刷時は店舗名、住所、QRコードのみを出力します。
            </p>
            <button
              type="button"
              onClick={handlePrint}
              className="mt-4 w-full rounded-xl bg-gray-950 py-2.5 text-sm font-bold text-white hover:bg-gray-800"
            >
              QRを印刷
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
