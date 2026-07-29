import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { del, get, post } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface UserRow {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
  is_active: boolean;
  account_status: 'invited' | 'active' | 'disabled';
  phone: string | null;
  address_line1: string | null;
  job_title: string | null;
  employee_code: string | null;
}
export function ManagerUsersPage() {
  const { t } = useTranslation(['manager', 'common']);
  const { user } = useAuthStore();
  const orgId = user?.organizationId;
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const emptyForm = {
    displayName: '',
    email: '',
    phone: '',
    currentAddress: '',
    jobTitle: '',
    employeeCode: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [addError, setAddError] = useState('');

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ['users-staff', user?.branchIds?.[0]],
    queryFn: () => get<UserRow[]>('/api/v1/users?role=staff'),
    enabled: !!orgId && !user?.isOrganizationOwner,
  });
  const staffUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return users.filter(
      (candidate) =>
        candidate.role === 'staff' &&
        (!query ||
          candidate.display_name.toLocaleLowerCase().includes(query) ||
          candidate.email?.toLocaleLowerCase().includes(query) ||
          candidate.employee_code?.toLocaleLowerCase().includes(query))
    );
  }, [search, users]);

  const createMutation = useMutation({
    mutationFn: () => post('/api/v1/users/staff', form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users-staff'] });
      setShowAdd(false);
      setForm(emptyForm);
      setAddError('');
    },
    onError: (err: { message?: string }) =>
      setAddError(err?.message ?? t('errors.UNKNOWN', { ns: 'common' })),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => del(`/api/v1/users/staff/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users-staff'] }),
  });

  if (isLoading)
    return <div className="text-gray-400 text-sm">{t('states.loading', { ns: 'common' })}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('users.title')}</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700"
        >
          + {t('users.add')}
        </button>
      </div>
      <label className="flex max-w-xl items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
        <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
        <span className="sr-only">{t('users.search')}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('users.searchPlaceholder')}
          className="min-w-0 flex-1 border-0 py-2.5 text-sm outline-none"
        />
      </label>

      {staffUsers.length === 0 ? (
        <p className="text-gray-400 text-sm">{t('users.empty')}</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100 sm:hidden">
            {staffUsers.map((staffUser, index) => (
              <article key={staffUser.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-950 text-sm font-bold text-white">
                    {staffUser.display_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-bold text-gray-900">
                      {index + 1}. {staffUser.display_name}
                    </h2>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {staffUser.email ?? '—'}
                    </p>
                    <p className="mt-1 text-xs font-medium text-brand-700">
                      {t(`nav.${staffUser.role}`, {
                        ns: 'common',
                        defaultValue: staffUser.role,
                      })}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
                  <Link
                    to={`/manager/users/${staffUser.id}`}
                    className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"
                  >
                    {t('actions.open', { ns: 'common' })}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(t('users.deleteConfirm', { name: staffUser.display_name }))
                      ) {
                        deleteMutation.mutate(staffUser.id);
                      }
                    }}
                    className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                  >
                    {t('actions.delete', { ns: 'common' })}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <table className="hidden w-full text-sm sm:table">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
                <th className="w-16 whitespace-nowrap px-4 py-3 text-center font-medium">
                  {t('labels.number', { ns: 'common' })}
                </th>
                <th className="px-4 py-3 font-medium">{t('labels.name', { ns: 'common' })}</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Email</th>
                <th className="px-4 py-3 font-medium">{t('labels.role', { ns: 'common' })}</th>
                <th className="px-4 py-3 font-medium text-center">{t('users.status')}</th>
              </tr>
            </thead>
            <tbody>
              {staffUsers.map((u, index) => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 text-center text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{u.display_name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {t(`nav.${u.role}`, { ns: 'common', defaultValue: u.role })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        to={`/manager/users/${u.id}`}
                        className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
                      >
                        {t('actions.open', { ns: 'common' })}
                      </Link>
                      <button
                        onClick={() => {
                          if (window.confirm(t('users.deleteConfirm', { name: u.display_name }))) {
                            deleteMutation.mutate(u.id);
                          }
                        }}
                        className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        {t('actions.delete', { ns: 'common' })}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add staff modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-sm space-y-4 overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-6">
            <h2 className="font-semibold text-gray-900">{t('users.add')}</h2>

            {[
              {
                label: t('users.displayNameRequired'),
                key: 'displayName',
                type: 'text',
                placeholder: t('labels.displayName', { ns: 'common' }),
              },
              { label: 'Email *', key: 'email', type: 'email', placeholder: 'nv@salon.com' },
              {
                label: t('users.phoneRequired'),
                key: 'phone',
                type: 'tel',
                placeholder: '09012345678',
              },
              {
                label: t('users.addressRequired'),
                key: 'currentAddress',
                type: 'text',
                placeholder: t('users.addressPlaceholder'),
              },
              {
                label: t('users.jobTitleRequired'),
                key: 'jobTitle',
                type: 'text',
                placeholder: t('users.jobTitlePlaceholder'),
              },
              {
                label: t('users.employeeCodeRequired'),
                key: 'employeeCode',
                type: 'text',
                placeholder: 'ST-001',
              },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            ))}
            {addError && <p className="text-xs text-red-500">{addError}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setShowAdd(false);
                  setAddError('');
                }}
                className="flex-1 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {t('actions.cancel', { ns: 'common' })}
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={
                  createMutation.isPending ||
                  !form.displayName ||
                  !form.email ||
                  !form.phone ||
                  !form.currentAddress ||
                  !form.jobTitle ||
                  !form.employeeCode
                }
                className="flex-1 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {createMutation.isPending
                  ? t('actions.saving', { ns: 'common' })
                  : t('actions.save', { ns: 'common' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
