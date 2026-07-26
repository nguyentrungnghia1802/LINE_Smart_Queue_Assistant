import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { del, get, patch, post } from '../../services/apiClient';
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
interface Branch {
  id: string;
  name: string;
}

export function ManagerUsersPage() {
  const { t } = useTranslation(['manager', 'common']);
  const { user } = useAuthStore();
  const orgId = user?.organizationId;
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const emptyForm = {
    displayName: '',
    email: '',
    phone: '',
    currentAddress: '',
    jobTitle: '',
    employeeCode: '',
    branchId: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [addError, setAddError] = useState('');

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ['users-staff', orgId],
    queryFn: () => get<UserRow[]>(`/api/v1/users?orgId=${orgId}&role=staff`),
    enabled: !!orgId,
  });
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => get<Branch[]>('/api/v1/branches'),
  });

  const staffUsers = useMemo(() => users.filter((u) => u.role === 'staff'), [users]);

  const createMutation = useMutation({
    mutationFn: () => post('/api/v1/users/staff', form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users-staff', orgId] });
      setShowAdd(false);
      setForm(emptyForm);
      setAddError('');
    },
    onError: (err: { message?: string }) =>
      setAddError(err?.message ?? t('errors.UNKNOWN', { ns: 'common' })),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const profile = {
        displayName: form.displayName,
        email: form.email,
        phone: form.phone,
        currentAddress: form.currentAddress,
        jobTitle: form.jobTitle,
        employeeCode: form.employeeCode || null,
      };
      return patch(`/api/v1/users/staff/${editingUserId}`, profile);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users-staff', orgId] });
      setEditingUserId(null);
      setShowAdd(false);
      setForm(emptyForm);
      setAddError('');
    },
    onError: (err: { message?: string }) =>
      setAddError(err?.message ?? t('errors.UNKNOWN', { ns: 'common' })),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => del(`/api/v1/users/staff/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users-staff', orgId] }),
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

      {staffUsers.length === 0 ? (
        <p className="text-gray-400 text-sm">{t('users.empty')}</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100 sm:hidden">
            {staffUsers.map((staffUser) => (
              <article key={staffUser.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-950 text-sm font-bold text-white">
                    {staffUser.display_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-bold text-gray-900">{staffUser.display_name}</h2>
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
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUserId(staffUser.id);
                      setShowAdd(true);
                      setForm({
                        displayName: staffUser.display_name,
                        email: staffUser.email ?? '',
                        phone: staffUser.phone ?? '',
                        currentAddress: staffUser.address_line1 ?? '',
                        jobTitle: staffUser.job_title ?? '',
                        employeeCode: staffUser.employee_code ?? '',
                        branchId: branches[0]?.id ?? '',
                      });
                      setAddError('');
                    }}
                    className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"
                  >
                    {t('actions.edit', { ns: 'common' })}
                  </button>
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
                <th className="px-4 py-3 font-medium">{t('labels.name', { ns: 'common' })}</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Email</th>
                <th className="px-4 py-3 font-medium">{t('labels.role', { ns: 'common' })}</th>
                <th className="px-4 py-3 font-medium text-center">{t('users.status')}</th>
              </tr>
            </thead>
            <tbody>
              {staffUsers.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-800">{u.display_name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {t(`nav.${u.role}`, { ns: 'common', defaultValue: u.role })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setEditingUserId(u.id);
                          setShowAdd(true);
                          setForm({
                            displayName: u.display_name,
                            email: u.email ?? '',
                            phone: u.phone ?? '',
                            currentAddress: u.address_line1 ?? '',
                            jobTitle: u.job_title ?? '',
                            employeeCode: u.employee_code ?? '',
                            branchId: branches[0]?.id ?? '',
                          });
                          setAddError('');
                        }}
                        className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
                      >
                        {t('actions.edit', { ns: 'common' })}
                      </button>
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
            <h2 className="font-semibold text-gray-900">
              {editingUserId ? t('users.edit') : t('users.add')}
            </h2>

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
                label: t('users.employeeCode'),
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
            {!editingUserId && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {t('users.branchRequired')}
                </label>
                <select
                  required
                  value={form.branchId}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, branchId: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t('users.selectBranch')}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
                onClick={() => {
                  if (editingUserId) {
                    updateMutation.mutate();
                  } else {
                    createMutation.mutate();
                  }
                }}
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  !form.displayName ||
                  !form.email ||
                  !form.phone ||
                  !form.currentAddress ||
                  !form.jobTitle ||
                  (!editingUserId && !form.branchId)
                }
                className="flex-1 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? t('actions.saving', { ns: 'common' })
                  : editingUserId
                    ? t('actions.edit', { ns: 'common' })
                    : t('actions.save', { ns: 'common' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
