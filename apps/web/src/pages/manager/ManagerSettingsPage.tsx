import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

import { get, patch } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  phone: string | null;
  address: string | null;
  paymentInfo: string | null;
  publicQrToken: string | null;
  joinUrl: string | null;
}

export function ManagerSettingsPage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [orgForm, setOrgForm] = useState({
    name: '',
    logoUrl: '',
    address: '',
    phone: '',
    paymentInfo: '',
  });
  const [saved, setSaved] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);
  const [error, setError] = useState('');

  const { data: org } = useQuery<OrgInfo>({
    queryKey: ['manager-my-org'],
    queryFn: () => get<OrgInfo>('/api/v1/orgs/my-org'),
  });

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
    setEmail(user?.email ?? '');
  }, [user]);

  useEffect(() => {
    if (!org) return;
    setOrgForm({
      name: org.name,
      logoUrl: org.logoUrl ?? '',
      address: org.address ?? '',
      phone: org.phone ?? '',
      paymentInfo: org.paymentInfo ?? '',
    });
  }, [org]);

  const mutation = useMutation({
    mutationFn: (dto: { displayName: string }) =>
      patch<{ displayName: string; email: string }>('/api/v1/users/me', dto),
    onSuccess: (data) => {
      if (user) {
        setUser({ ...user, displayName: data.displayName, email: data.email });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => setError('Có lỗi xảy ra. Vui lòng thử lại.'),
  });

  const orgMutation = useMutation({
    mutationFn: (dto: {
      name: string;
      logoUrl?: string | null;
      address?: string | null;
      phone?: string | null;
      paymentInfo?: string | null;
    }) => patch<OrgInfo>('/api/v1/orgs/my-org', dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-my-org'] });
      setOrgSaved(true);
      setTimeout(() => setOrgSaved(false), 2000);
    },
    onError: () => setError('Có lỗi xảy ra. Vui lòng thử lại.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    mutation.mutate({ displayName });
  }

  function handleOrgSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    orgMutation.mutate({
      name: orgForm.name,
      logoUrl: orgForm.logoUrl.trim() || null,
      address: orgForm.address.trim() || null,
      phone: orgForm.phone.trim() || null,
      paymentInfo: orgForm.paymentInfo.trim() || null,
    });
  }

  const joinUrl =
    org?.joinUrl ?? (org?.publicQrToken ? `${window.location.origin}/qr/${org.publicQrToken}` : '');

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Cài đặt</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
      >
        <h2 className="text-sm font-semibold text-gray-700">Thông tin cá nhân</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
            value={email}
            disabled
          />
          <p className="text-xs text-gray-400 mt-1">Email không thể thay đổi</p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {saved && <p className="text-sm text-green-600">Đã lưu thành công!</p>}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="px-6 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </form>

      <form
        onSubmit={handleOrgSubmit}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
      >
        <h2 className="text-sm font-semibold text-gray-700">Thông tin tổ chức</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tên tổ chức</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={orgForm.name}
            onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={orgForm.logoUrl}
            onChange={(e) => setOrgForm((f) => ({ ...f, logoUrl: e.target.value }))}
            type="url"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={orgForm.phone}
              onChange={(e) => setOrgForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={orgForm.address}
              onChange={(e) => setOrgForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Thông tin thanh toán
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            rows={4}
            value={orgForm.paymentInfo}
            onChange={(e) => setOrgForm((f) => ({ ...f, paymentInfo: e.target.value }))}
          />
        </div>

        <div className="border-t border-gray-100 pt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Public QR token
              </label>
              <input
                readOnly
                value={org?.publicQrToken ?? ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Public join URL
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={joinUrl}
                  className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(joinUrl)}
                  className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
          {joinUrl && (
            <div className="flex items-center justify-center">
              <QRCodeSVG value={joinUrl} size={120} />
            </div>
          )}
        </div>

        {orgSaved && <p className="text-sm text-green-600">Đã lưu thông tin tổ chức!</p>}

        <button
          type="submit"
          disabled={orgMutation.isPending}
          className="px-6 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          {orgMutation.isPending ? 'Đang lưu...' : 'Lưu tổ chức'}
        </button>
      </form>
    </div>
  );
}
