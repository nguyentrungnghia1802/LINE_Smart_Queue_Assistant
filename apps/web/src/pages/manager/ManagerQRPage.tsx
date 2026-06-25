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
        <h1 className="text-xl font-bold text-gray-900">Xuất mã QR</h1>
        <p className="text-gray-400">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Xuất mã QR</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ── Web QR ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center gap-4">
          <h2 className="text-sm font-semibold text-gray-700 self-start">
            🌐 Web QR (trình duyệt)
          </h2>
          <div ref={printRef} className="flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-gray-700">
              {orgData?.name ?? 'Cơ sở của bạn'}
            </p>
            {orgData?.address && <p className="text-xs text-gray-500">{orgData.address}</p>}
            <QRCodeSVG value={joinUrl} size={200} />
            <p className="text-xs text-gray-400 text-center break-all">{joinUrl}</p>
          </div>
          <p className="text-xs text-gray-500 text-center">
            Khách quét để đặt hàng qua trình duyệt
          </p>
          <div className="flex gap-2 w-full">
            <button
              onClick={handleCopy}
              className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
            >
              📋 Copy link
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700"
            >
              In QR
            </button>
          </div>
        </div>

        {/* ── LINE LIFF QR ── */}
        <div className="bg-white rounded-xl border border-[#06C755]/40 p-6 flex flex-col items-center gap-4">
          <h2 className="text-sm font-semibold text-gray-700 self-start flex items-center gap-1">
            <span className="text-[#06C755] text-base">●</span> LINE LIFF (ứng dụng LINE)
          </h2>
          {liffUrl ? (
            <>
              <div className="flex flex-col items-center gap-3">
                <QRCodeSVG value={liffUrl} size={200} fgColor="#06C755" />
                <p className="text-xs text-gray-400 text-center break-all">{liffUrl}</p>
              </div>
              <p className="text-xs text-gray-500 text-center">
                Khách quét để mở giao diện trong{' '}
                <span className="font-medium text-[#06C755]">LINE App</span> (cần cài LINE trên điện
                thoại)
              </p>
              <button
                onClick={handleCopyLiff}
                className="w-full py-2 bg-[#06C755] text-white text-sm rounded-lg hover:bg-[#05b54c]"
              >
                📋 Copy LIFF link
              </button>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-6">
              <p className="text-3xl">⚙️</p>
              <p className="text-sm text-gray-500 text-center">
                Chưa cấu hình <code className="bg-gray-100 px-1 rounded">VITE_LIFF_ID</code>
              </p>
              <p className="text-xs text-gray-400 text-center">
                Thêm LIFF App ID vào file <code>.env</code> để kích hoạt tính năng này.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid md:grid-cols-2 gap-4 text-xs text-gray-500">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="font-medium text-gray-700 mb-1">📱 Cách hoạt động — Web QR</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Khách quét QR bằng camera hoặc ứng dụng bất kỳ</li>
            <li>Trình duyệt mở trang đặt hàng</li>
            <li>Chọn sản phẩm → Lấy số thứ tự</li>
          </ol>
        </div>
        <div className="bg-[#06C755]/5 rounded-lg p-3">
          <p className="font-medium text-gray-700 mb-1">💬 Cách hoạt động — LINE LIFF</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Khách quét QR trong ứng dụng LINE</li>
            <li>Giao diện LIFF mở trong LINE</li>
            <li>Tự động đăng nhập → Lấy số + nhận thông báo LINE</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
