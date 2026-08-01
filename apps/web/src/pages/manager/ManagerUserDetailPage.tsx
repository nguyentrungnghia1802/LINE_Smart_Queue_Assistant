import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { ApiClientError, get, patch } from '../../services/apiClient';
import { type ApiFieldErrors, getApiFieldErrors, INPUT_LIMITS } from '../../utils/formValidation';

interface StaffUser {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  job_title: string | null;
  employee_code: string | null;
  account_status: 'invited' | 'active' | 'disabled';
  created_at: string;
}

export function ManagerUserDetailPage() {
  const { t, i18n } = useTranslation(['manager', 'common']);
  const { userId = '' } = useParams<{ userId: string }>();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});
  const [form, setForm] = useState({
    displayName: '',
    phone: '',
    currentAddress: '',
    jobTitle: '',
    employeeCode: '',
  });
  const userQuery = useQuery<StaffUser>({
    queryKey: ['staff-user', userId],
    queryFn: () => get<StaffUser>(`/api/v1/users/${userId}`),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    const user = userQuery.data;
    if (!user) return;
    setForm({
      displayName: user.display_name,
      phone: user.phone ?? '',
      currentAddress: user.address_line1 ?? '',
      jobTitle: user.job_title ?? '',
      employeeCode: user.employee_code ?? '',
    });
  }, [userQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () => patch(`/api/v1/users/staff/${userId}`, form),
    onMutate: () => setFieldErrors({}),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff-user', userId] }),
        queryClient.invalidateQueries({ queryKey: ['users-staff'] }),
      ]);
      setEditing(false);
      setError('');
    },
    onError: (updateError) => {
      setFieldErrors(getApiFieldErrors(updateError));
      setError(
        updateError instanceof ApiClientError ? updateError.message : t('users.updateFailed')
      );
    },
  });

  if (userQuery.isLoading || !userQuery.data) {
    return <p className="text-sm text-gray-500">{t('states.loading', { ns: 'common' })}</p>;
  }
  const user = userQuery.data;
  const createdAt = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'ja', {
    dateStyle: 'medium',
  }).format(new Date(user.created_at));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/manager/users" className="text-sm font-bold text-brand-700 hover:underline">
            ← {t('users.title')}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-950">{user.display_name}</h1>
          <p className="mt-1 text-sm text-gray-500">{user.employee_code ?? '-'}</p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-bold text-white"
          >
            {t('actions.edit', { ns: 'common' })}
          </button>
        )}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        {editing ? (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              updateMutation.mutate();
            }}
          >
            <ReadOnlyField label={t('labels.email', { ns: 'common' })} value={user.email ?? '-'} />
            {(
              [
                [
                  'displayName',
                  t('labels.displayName', { ns: 'common' }),
                  t('users.namePlaceholder'),
                ],
                ['phone', t('labels.phone', { ns: 'common' }), '09012345678'],
                [
                  'currentAddress',
                  t('labels.address', { ns: 'common' }),
                  t('users.addressPlaceholder'),
                ],
                ['jobTitle', t('users.jobTitleRequired'), t('users.jobTitlePlaceholder')],
                ['employeeCode', t('users.employeeCodeRequired'), 'ST-001'],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key} className="text-sm font-medium text-gray-700">
                {label}
                <input
                  name={key}
                  required
                  maxLength={staffFieldMaxLength(key)}
                  value={form[key]}
                  placeholder={placeholder}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [key]: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                />
                {fieldErrors[key]?.[0] && (
                  <span className="mt-1 block text-xs font-medium text-red-700" role="alert">
                    {fieldErrors[key]?.[0]}
                  </span>
                )}
              </label>
            ))}
            {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            <div className="flex gap-2 sm:col-span-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold"
              >
                {t('actions.cancel', { ns: 'common' })}
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {t('actions.save', { ns: 'common' })}
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <ReadOnlyField label={t('labels.email', { ns: 'common' })} value={user.email ?? '-'} />
            <ReadOnlyField label={t('labels.phone', { ns: 'common' })} value={user.phone ?? '-'} />
            <ReadOnlyField
              label={t('labels.address', { ns: 'common' })}
              value={user.address_line1 ?? '-'}
            />
            <ReadOnlyField label={t('users.jobTitleRequired')} value={user.job_title ?? '-'} />
            <ReadOnlyField
              label={t('users.employeeCodeRequired')}
              value={user.employee_code ?? '-'}
            />
            <ReadOnlyField
              label={t('users.status')}
              value={t(`users.states.${user.account_status}`)}
            />
            <ReadOnlyField label={t('users.createdAt')} value={createdAt} />
          </dl>
        )}
      </section>
    </div>
  );
}

function staffFieldMaxLength(key: string): number {
  const limits: Record<string, number> = {
    displayName: INPUT_LIMITS.displayName,
    phone: INPUT_LIMITS.phone,
    currentAddress: INPUT_LIMITS.currentAddress,
    jobTitle: INPUT_LIMITS.jobTitle,
    employeeCode: INPUT_LIMITS.employeeCode,
  };
  return limits[key] ?? INPUT_LIMITS.shortDescription;
}

function ReadOnlyField({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-xs font-bold text-gray-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}
