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

  // LIFF URL: https://liff.line.me/{LIFF_ID} (with optional deep-link state)
  const liffUrl = LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : null;

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
      `<html><head><title>QR Code</title><style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}</style></head><body>${content.innerHTML}</body></html>`
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
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">QR</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-950">QRコード表示</h1>
        <p className="mt-1 text-sm text-gray-500">顧客が読み取る受付リンクを管理します。</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Web QR ── */}
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/80 bg-white p-6 shadow-[var(--shadow-soft)]">
          <h2 className="self-start font-bold text-gray-950">Web QR（ブラウザ）</h2>
          <div ref={printRef} className="flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-gray-700">{orgData?.name ?? '店舗'}</p>
            {orgData?.address && <p className="text-xs text-gray-500">{orgData.address}</p>}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <QRCodeSVG value={joinUrl} size={200} />
            </div>
            <p className="text-xs text-gray-400 text-center break-all">{joinUrl}</p>
          </div>
          <p className="text-xs text-gray-500 text-center">
            顧客が読み取るとブラウザで注文できます
          </p>
          <div className="flex gap-2 w-full">
            <button
              onClick={handleCopy}
              className="flex-1 rounded-xl bg-gray-100 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200"
            >
              リンクをコピー
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 rounded-xl bg-gray-950 py-2 text-sm font-bold text-white hover:bg-gray-800"
            >
              QRを印刷
            </button>
          </div>
        </div>

        {/* ── LINE LIFF QR ── */}
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#06C755]/30 bg-white p-6 shadow-[var(--shadow-soft)]">
          <h2 className="self-start flex items-center gap-1 font-bold text-gray-950">
            <span className="text-[#06C755] text-base">●</span> LINE LIFF（LINEアプリ）
          </h2>
          {liffUrl ? (
            <>
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <QRCodeSVG value={liffUrl} size={200} fgColor="#06C755" />
                </div>
                <p className="text-xs text-gray-400 text-center break-all">{liffUrl}</p>
              </div>
              <p className="text-xs text-gray-500 text-center">
                顧客が読み取ると <span className="font-medium text-[#06C755]">LINEアプリ</span>
                で画面を開きます（端末にLINEが必要です）
              </p>
              <button
                onClick={handleCopyLiff}
                className="w-full rounded-xl bg-[#06C755] py-2 text-sm font-bold text-white hover:bg-[#05b54c]"
              >
                LIFFリンクをコピー
              </button>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-6">
              <p className="text-sm text-gray-500 text-center">
                未設定: <code className="bg-gray-100 px-1 rounded">VITE_LIFF_ID</code>
              </p>
              <p className="text-xs text-gray-400 text-center">
                LIFF App IDを <code>.env</code> に追加すると、この機能を有効化できます。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 text-xs text-gray-500 md:grid-cols-2">
        <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-[var(--shadow-soft)]">
          <p className="mb-1 font-bold text-gray-700">使い方 — Web QR</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>顧客がカメラまたは任意のアプリでQRを読み取る</li>
            <li>ブラウザで注文ページが開く</li>
            <li>商品を選択 → 受付番号を取得</li>
          </ol>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-[var(--shadow-soft)]">
          <p className="mb-1 font-bold text-gray-700">使い方 — LINE LIFF</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>顧客がLINEアプリでQRを読み取る</li>
            <li>LINE内でLIFF画面が開く</li>
            <li>自動ログイン → 受付番号取得 + LINE通知受信</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
