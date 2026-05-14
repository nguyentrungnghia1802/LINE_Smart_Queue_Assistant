import { useQuery } from '@tanstack/react-query';

import { API_BASE_PATH } from '@line-queue/shared';

import { get } from '../../services/apiClient';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export function AdminOrgsPage() {
  const { data, isLoading } = useQuery<OrgRow[]>({
    queryKey: ['admin-orgs'],
    queryFn: () => get<OrgRow[]>(`${API_BASE_PATH}/admin/organizations`),
    retry: false,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tổ chức</h1>

      {isLoading && <p className="text-gray-500 text-sm">Đang tải...</p>}

      {data && data.length === 0 && <p className="text-gray-500 text-sm">Chưa có tổ chức nào.</p>}

      {data && data.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Tên</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Slug</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{org.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono">{org.slug}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(org.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
