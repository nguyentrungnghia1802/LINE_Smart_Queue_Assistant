import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { API_BASE_PATH } from '@line-queue/shared';

import { del, get, patch, post } from '../../services/apiClient';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  created_at: string;
}

interface ManagerRow {
  id: string;
  display_name: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

interface ManagerForm {
  displayName: string;
  email: string;
  password: string;
}

export function AdminOrgsPage() {
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null);
  const [form, setForm] = useState<ManagerForm>({ displayName: '', email: '', password: '' });
  const [error, setError] = useState('');

  const { data: orgs = [], isLoading: orgsLoading } = useQuery<OrgRow[]>({
    queryKey: ['admin-orgs'],
    queryFn: () => get<OrgRow[]>(`${API_BASE_PATH}/admin/organizations`),
    retry: false,
  });

  const selectedOrg = useMemo(
    () => orgs.find((org) => org.id === selectedOrgId) ?? orgs[0] ?? null,
    [orgs, selectedOrgId]
  );
  const activeOrgId = selectedOrg?.id;

  const { data: managers = [], isLoading: managersLoading } = useQuery<ManagerRow[]>({
    queryKey: ['admin-org-managers', activeOrgId],
    queryFn: () =>
      get<ManagerRow[]>(`${API_BASE_PATH}/admin/organizations/${activeOrgId}/managers`),
    enabled: !!activeOrgId,
  });

  const invalidateManagers = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-org-managers', activeOrgId] });

  const createManager = useMutation({
    mutationFn: (payload: ManagerForm) =>
      post<ManagerRow>(`${API_BASE_PATH}/admin/organizations/${activeOrgId}/managers`, payload),
    onSuccess: () => {
      void invalidateManagers();
      resetForm();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Không thể tạo manager.'),
  });

  const updateManager = useMutation({
    mutationFn: (payload: ManagerForm & { id: string }) =>
      patch<ManagerRow>(
        `${API_BASE_PATH}/admin/organizations/${activeOrgId}/managers/${payload.id}`,
        {
          displayName: payload.displayName,
          email: payload.email,
          ...(payload.password ? { password: payload.password } : {}),
        }
      ),
    onSuccess: () => {
      void invalidateManagers();
      resetForm();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Không thể cập nhật manager.'),
  });

  const removeManager = useMutation({
    mutationFn: (managerId: string) =>
      del(`${API_BASE_PATH}/admin/organizations/${activeOrgId}/managers/${managerId}`),
    onSuccess: () => void invalidateManagers(),
    onError: (err) => setError(err instanceof Error ? err.message : 'Không thể xoá manager.'),
  });

  function resetForm() {
    setEditingManagerId(null);
    setForm({ displayName: '', email: '', password: '' });
    setError('');
  }

  function startEdit(manager: ManagerRow) {
    setEditingManagerId(manager.id);
    setForm({
      displayName: manager.display_name,
      email: manager.email ?? '',
      password: '',
    });
    setError('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeOrgId) return;
    setError('');

    if (editingManagerId) {
      updateManager.mutate({ ...form, id: editingManagerId });
    } else {
      createManager.mutate(form);
    }
  }

  function handleDelete(manager: ManagerRow) {
    const confirmed = window.confirm(`Xoá manager ${manager.display_name}?`);
    if (confirmed) removeManager.mutate(manager.id);
  }

  const saving = createManager.isPending || updateManager.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tổ chức</h1>
        <p className="mt-1 text-sm text-gray-500">
          Chọn một organization để xem và quản lý manager thuộc organization đó.
        </p>
      </div>

      {orgsLoading && <p className="text-gray-500 text-sm">Đang tải...</p>}

      {!orgsLoading && orgs.length === 0 && (
        <p className="text-gray-500 text-sm">Chưa có tổ chức nào.</p>
      )}

      {orgs.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Organizations</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {orgs.map((org) => {
                const selected = org.id === activeOrgId;
                return (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => {
                      setSelectedOrgId(org.id);
                      resetForm();
                    }}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      selected ? 'bg-brand-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{org.name}</div>
                    <div className="mt-0.5 text-xs font-mono text-gray-500">{org.slug}</div>
                    <div className="mt-1 text-xs text-gray-400">
                      {new Date(org.created_at).toLocaleDateString('vi-VN')}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedOrg?.name}</h2>
                  <p className="text-sm text-gray-500">
                    {selectedOrg?.address ?? 'Chưa có địa chỉ'}
                  </p>
                </div>
                <span className="text-xs font-mono text-gray-400">{selectedOrg?.id}</span>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  {editingManagerId ? 'Sửa manager' : 'Thêm manager'}
                </h3>
                {editingManagerId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-sm text-gray-500 hover:text-gray-900"
                  >
                    Huỷ sửa
                  </button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <input
                  value={form.displayName}
                  onChange={(e) => setForm((v) => ({ ...v, displayName: e.target.value }))}
                  placeholder="Tên manager"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  required
                />
                <input
                  value={form.email}
                  onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
                  placeholder="Email"
                  type="email"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  required
                />
                <input
                  value={form.password}
                  onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
                  placeholder={editingManagerId ? 'Mật khẩu mới nếu đổi' : 'Mật khẩu'}
                  type="password"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  required={!editingManagerId}
                />
              </div>

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : editingManagerId ? 'Lưu thay đổi' : 'Thêm manager'}
              </button>
            </form>

            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">Managers</h3>
              </div>

              {managersLoading ? (
                <p className="p-4 text-sm text-gray-500">Đang tải managers...</p>
              ) : managers.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Organization này chưa có manager.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Tên</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Trạng thái</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {managers.map((manager) => (
                      <tr key={manager.id}>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {manager.display_name}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{manager.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              manager.is_active
                                ? 'bg-green-50 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {manager.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => startEdit(manager)}
                            className="rounded-md px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-50"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(manager)}
                            className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                          >
                            Xoá
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
