import { QRCodeSVG } from 'qrcode.react';
import { useRef } from 'react';

import { useAuthStore } from '../../store/authStore';

export function ManagerQRPage() {
  const { user } = useAuthStore();
  const printRef = useRef<HTMLDivElement>(null);

  // We need the org slug — stored via the login flow we can get it from the API
  // For now use organizationId-based QR as fallback until slug is stored in authStore
  const orgSlug = (user as { orgSlug?: string } | null)?.orgSlug;
  const joinUrl = orgSlug
    ? `${window.location.origin}/q/${orgSlug}`
    : `${window.location.origin}/join/demo`;

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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Xuất mã QR</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center gap-6 max-w-sm">
        <div ref={printRef} className="flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-gray-700">{user?.displayName ?? 'Cơ sở của bạn'}</p>
          <QRCodeSVG value={joinUrl} size={220} />
          <p className="text-xs text-gray-400 text-center break-all">{joinUrl}</p>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Khách hàng quét mã QR này để đặt hàng và lấy số thứ tự
        </p>

        <button
          onClick={handlePrint}
          className="w-full py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700"
        >
          In QR
        </button>
      </div>
    </div>
  );
}
