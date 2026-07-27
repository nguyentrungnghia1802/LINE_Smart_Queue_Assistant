import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ApiClientError, del, get, post } from '../../services/apiClient';

type Branch = {
  id: string;
  name: string;
  phone: string;
  postal_code: string;
  prefecture: string;
  city: string;
  address_line1: string;
  manager_count: number;
  staff_count: number;
  queue_count: number;
  queues: Array<{ id: string; name: string; status: string }>;
  managers: Array<{
    id: string;
    displayName: string;
    email: string;
    accountStatus: string;
    isOwner: boolean;
  }>;
};

const initial = {
  name: '',
  phone: '',
  email: '',
  postalCode: '',
  prefecture: '',
  city: '',
  addressLine1: '',
  addressLine2: '',
  latitude: '',
  longitude: '',
  managerName: '',
  managerEmail: '',
  managerPhone: '',
  managerTitle: '',
};

export function ManagerBranchesPage() {
  const { t } = useTranslation(['manager', 'common']);
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [inviteBranchId, setInviteBranchId] = useState<string | null>(null);
  const [form, setForm] = useState(initial);
  const [managerForm, setManagerForm] = useState({
    managerName: '',
    managerEmail: '',
    managerPhone: '',
    managerTitle: '',
  });
  const [search, setSearch] = useState('');
  const { data = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => get('/api/v1/branches'),
  });
  const visibleBranches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return data.filter(
      (branch) =>
        !query ||
        branch.name.toLocaleLowerCase().includes(query) ||
        branch.city.toLocaleLowerCase().includes(query) ||
        branch.address_line1.toLocaleLowerCase().includes(query)
    );
  }, [data, search]);
  const create = useMutation({
    mutationFn: () =>
      post('/api/v1/branches', {
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        postalCode: form.postalCode,
        prefecture: form.prefecture,
        city: form.city,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2 || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        managers: [
          {
            displayName: form.managerName,
            email: form.managerEmail,
            phone: form.managerPhone,
            jobTitle: form.managerTitle,
          },
        ],
      }),
    onSuccess: () => {
      setOpen(false);
      setForm(initial);
      void client.invalidateQueries({ queryKey: ['branches'] });
    },
  });
  const invite = useMutation({
    mutationFn: () =>
      post(`/api/v1/branches/${inviteBranchId}/managers`, {
        displayName: managerForm.managerName,
        email: managerForm.managerEmail,
        phone: managerForm.managerPhone,
        jobTitle: managerForm.managerTitle,
      }),
    onSuccess: () => {
      setInviteBranchId(null);
      setManagerForm({ managerName: '', managerEmail: '', managerPhone: '', managerTitle: '' });
      void client.invalidateQueries({ queryKey: ['branches'] });
    },
  });
  const remove = useMutation({
    mutationFn: ({ branchId, userId }: { branchId: string; userId: string }) =>
      del(`/api/v1/branches/${branchId}/managers/${userId}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['branches'] }),
  });
  const fields = [
    'name',
    'phone',
    'email',
    'postalCode',
    'prefecture',
    'city',
    'addressLine1',
    'addressLine2',
    'latitude',
    'longitude',
    'managerName',
    'managerEmail',
    'managerPhone',
    'managerTitle',
  ] as const;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('branches.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('branches.description')}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-4 py-2.5 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" />
          {t('branches.add')}
        </button>
      </header>
      <label className="flex max-w-xl items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
        <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
        <span className="sr-only">{t('branches.search')}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('branches.searchPlaceholder')}
          className="min-w-0 flex-1 border-0 py-2.5 text-sm outline-none"
        />
      </label>
      <div className="grid gap-4 lg:grid-cols-2">
        {visibleBranches.map((branch, index) => (
          <article key={branch.id} className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-brand-600" />
              <div>
                <h2 className="font-bold">
                  {index + 1}. {branch.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  〒{branch.postal_code} {branch.prefecture}
                  {branch.city}
                  {branch.address_line1}
                </p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
              <div>
                <dt className="text-gray-500">{t('branches.managers')}</dt>
                <dd className="font-bold">{branch.manager_count}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('branches.staff')}</dt>
                <dd className="font-bold">{branch.staff_count}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('branches.queue')}</dt>
                <dd className="truncate font-bold">{branch.queue_count}</dd>
              </div>
            </dl>
            <Link
              to={`/manager/branches/${branch.id}`}
              className="mt-4 inline-flex text-sm font-bold text-brand-700"
            >
              {t('branches.viewDetails')}
            </Link>
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-gray-500">
                  {t('branches.managers')}
                </h3>
                <button
                  onClick={() => setInviteBranchId(branch.id)}
                  className="text-xs font-bold text-brand-700"
                >
                  {t('branches.addManager')}
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {branch.managers.map((manager) => (
                  <div
                    key={manager.id}
                    className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold">{manager.displayName}</p>
                      <p className="truncate text-xs text-gray-500">
                        {manager.email} · {t(`branches.accountStatus.${manager.accountStatus}`)}
                      </p>
                    </div>
                    {!manager.isOwner && (
                      <button
                        onClick={() => remove.mutate({ branchId: branch.id, userId: manager.id })}
                        className="shrink-0 text-xs font-semibold text-red-700"
                      >
                        {t('branches.removeManager')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
            className="mx-auto my-4 max-w-2xl rounded-lg bg-white p-5 sm:p-7"
          >
            <h2 className="text-xl font-bold">{t('branches.formTitle')}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {fields.map((key) => (
                <label
                  key={key}
                  className={
                    key === 'addressLine1' || key === 'addressLine2' ? 'sm:col-span-2' : ''
                  }
                >
                  <span className="mb-1 block text-xs font-bold text-gray-600">
                    {t(`branches.fields.${key}`)}
                  </span>
                  <input
                    required={!['email', 'addressLine2', 'latitude', 'longitude'].includes(key)}
                    type={
                      key.toLowerCase().includes('email')
                        ? 'email'
                        : ['latitude', 'longitude'].includes(key)
                          ? 'number'
                          : 'text'
                    }
                    step={['latitude', 'longitude'].includes(key) ? '0.000001' : undefined}
                    placeholder={t(`branches.placeholders.${key}`)}
                    value={form[key]}
                    onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  />
                </label>
              ))}
            </div>
            {create.error && (
              <p className="mt-4 text-sm text-red-700">
                {create.error instanceof ApiClientError &&
                create.error.code === 'BRANCH_PLAN_LIMIT_REACHED'
                  ? t('errors.BRANCH_PLAN_LIMIT_REACHED', { ns: 'common' })
                  : create.error.message}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2">
                {t('branches.cancel')}
              </button>
              <button
                disabled={create.isPending}
                className="rounded-lg bg-brand-600 px-5 py-2 font-bold text-white"
              >
                {t('branches.save')}
              </button>
            </div>
          </form>
        </div>
      )}
      {inviteBranchId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              invite.mutate();
            }}
            className="mx-auto my-10 max-w-md rounded-lg bg-white p-5 sm:p-7"
          >
            <h2 className="text-xl font-bold">{t('branches.inviteManager')}</h2>
            <div className="mt-5 space-y-4">
              {(['managerName', 'managerEmail', 'managerPhone', 'managerTitle'] as const).map(
                (key) => (
                  <label key={key}>
                    <span className="mb-1 block text-xs font-bold text-gray-600">
                      {t(`branches.fields.${key}`)}
                    </span>
                    <input
                      required
                      type={key === 'managerEmail' ? 'email' : 'text'}
                      placeholder={t(`branches.placeholders.${key}`)}
                      value={managerForm[key]}
                      onChange={(event) =>
                        setManagerForm((value) => ({ ...value, [key]: event.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                    />
                  </label>
                )
              )}
            </div>
            {invite.error && <p className="mt-4 text-sm text-red-700">{invite.error.message}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setInviteBranchId(null)} className="px-4 py-2">
                {t('branches.cancel')}
              </button>
              <button
                disabled={invite.isPending}
                className="rounded-lg bg-brand-600 px-5 py-2 font-bold text-white"
              >
                {t('branches.sendInvite')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
