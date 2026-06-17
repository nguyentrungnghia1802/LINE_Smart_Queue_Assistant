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

  function handleCopy() {
    void navigator.clipboard.writeText(joinUrl ?? '');
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
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Xuất mã QR</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center gap-6 max-w-sm">
        <div ref={printRef} className="flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-gray-700">{orgData?.name ?? 'Cơ sở của bạn'}</p>
          {orgData?.address && <p className="text-xs text-gray-500">{orgData.address}</p>}
          <QRCodeSVG value={joinUrl} size={220} />
          <p className="text-xs text-gray-400 text-center break-all">{joinUrl}</p>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Khách hàng quét mã QR này để đặt hàng và lấy số thứ tự
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

      {/* Join URL display */}
      <div className="max-w-sm">
        <label className="block text-xs font-medium text-gray-500 mb-1">Link QR public</label>
        <input
          readOnly
          value={joinUrl}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50 focus:outline-none"
          onFocus={(e) => e.target.select()}
        />
      </div>
    </div>
  );
}
