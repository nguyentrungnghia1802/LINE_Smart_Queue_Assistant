import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { API_BASE_PATH } from '@line-queue/shared';

import { del, get, patch, post } from '../../services/apiClient';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  public_qr_token: string | null;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  payment_info: string | null;
}

interface ManagerRow {
  id: string;
  display_name: string;
  email: string | null;
}

interface OrgForm {
  name: string;
  slug: string;
  publicQrToken: string;
  logoUrl: string;
  phone: string;
  address: string;
  paymentInfo: string;
}

interface ManagerForm {
  displayName: string;
  email: string;
  password: string;
}

const emptyOrgForm: OrgForm = {
  name: '',
  slug: '',
  publicQrToken: '',
  logoUrl: '',
  phone: '',
  address: '',
  paymentInfo: '',
};

const emptyManagerForm: ManagerForm = { displayName: '', email: '', password: '' };

export function AdminOrganizationsPage() {
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState<OrgForm>(emptyOrgForm);
  const [managerForm, setManagerForm] = useState<ManagerForm>(emptyManagerForm);
  const [error, setError] = useState('');

  const { data: orgs = [], isLoading: orgsLoading } = useQuery<OrgRow[]>({
    queryKey: ['admin-orgs'],
    queryFn: () => get<OrgRow[]>(`${API_BASE_PATH}/admin/organizations`),
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

  const refreshOrgs = () => queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
  const refreshManagers = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-org-managers', activeOrgId] });
  const onError = (err: unknown) => setError(err instanceof Error ? err.message : 'Action failed.');

  const createOrg = useMutation({
    mutationFn: (payload: OrgForm) =>
      post<OrgRow>(`${API_BASE_PATH}/admin/organizations`, orgPayload(payload, false)),
    onSuccess: (org) => {
      void refreshOrgs();
      setSelectedOrgId(org.id);
      resetOrgForm();
    },
    onError,
  });

  const updateOrg = useMutation({
    mutationFn: (payload: OrgForm & { id: string }) =>
      patch<OrgRow>(
        `${API_BASE_PATH}/admin/organizations/${payload.id}`,
        orgPayload(payload, true)
      ),
    onSuccess: (org) => {
      void refreshOrgs();
      setSelectedOrgId(org.id);
      resetOrgForm();
    },
    onError,
  });

  const removeOrg = useMutation({
    mutationFn: (orgId: string) => del(`${API_BASE_PATH}/admin/organizations/${orgId}`),
    onSuccess: () => {
      void refreshOrgs();
      setSelectedOrgId(null);
      resetOrgForm();
    },
    onError,
  });

  const createManager = useMutation({
    mutationFn: (payload: ManagerForm) =>
      post<ManagerRow>(`${API_BASE_PATH}/admin/organizations/${activeOrgId}/managers`, payload),
    onSuccess: () => {
      void refreshManagers();
      resetManagerForm();
    },
    onError,
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
      void refreshManagers();
      resetManagerForm();
    },
    onError,
  });

  const removeManager = useMutation({
    mutationFn: (managerId: string) =>
      del(`${API_BASE_PATH}/admin/organizations/${activeOrgId}/managers/${managerId}`),
    onSuccess: () => void refreshManagers(),
    onError,
  });

  function resetOrgForm() {
    setEditingOrgId(null);
    setOrgForm(emptyOrgForm);
    setError('');
  }

  function resetManagerForm() {
    setEditingManagerId(null);
    setManagerForm(emptyManagerForm);
    setError('');
  }

  function startEditOrg(org: OrgRow) {
    setEditingOrgId(org.id);
    setOrgForm({
      name: org.name,
      slug: org.slug,
      publicQrToken: org.public_qr_token ?? '',
      logoUrl: org.logo_url ?? '',
      phone: org.phone ?? '',
      address: org.address ?? '',
      paymentInfo: org.payment_info ?? '',
    });
    setError('');
  }

  function startEditManager(manager: ManagerRow) {
    setEditingManagerId(manager.id);
    setManagerForm({ displayName: manager.display_name, email: manager.email ?? '', password: '' });
    setError('');
  }

  function submitOrg(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (editingOrgId) {
      updateOrg.mutate({ ...orgForm, id: editingOrgId });
    } else {
      createOrg.mutate(orgForm);
    }
  }

  function submitManager(e: React.FormEvent) {
    e.preventDefault();
    if (!activeOrgId) return;
    setError('');
    if (editingManagerId) {
      updateManager.mutate({ ...managerForm, id: editingManagerId });
    } else {
      createManager.mutate(managerForm);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage organizations and the managers inside the selected organization.
        </p>
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={submitOrg} className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            {editingOrgId ? 'Edit organization' : 'Create organization'}
          </h2>
          {editingOrgId && (
            <button type="button" onClick={resetOrgForm} className="text-sm text-gray-500">
              Cancel edit
            </button>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <TextInput
            label="Name"
            value={orgForm.name}
            onChange={(name) => setOrgForm((v) => ({ ...v, name }))}
            required
          />
          <TextInput
            label="Slug"
            value={orgForm.slug}
            onChange={(slug) => setOrgForm((v) => ({ ...v, slug }))}
            required
          />
          <TextInput
            label="QR token"
            value={orgForm.publicQrToken}
            onChange={(publicQrToken) => setOrgForm((v) => ({ ...v, publicQrToken }))}
          />
          <TextInput
            label="Logo URL"
            value={orgForm.logoUrl}
            onChange={(logoUrl) => setOrgForm((v) => ({ ...v, logoUrl }))}
          />
          <TextInput
            label="Phone"
            value={orgForm.phone}
            onChange={(phone) => setOrgForm((v) => ({ ...v, phone }))}
          />
          <TextInput
            label="Address"
            value={orgForm.address}
            onChange={(address) => setOrgForm((v) => ({ ...v, address }))}
          />
          <TextInput
            label="Payment info"
            value={orgForm.paymentInfo}
            onChange={(paymentInfo) => setOrgForm((v) => ({ ...v, paymentInfo }))}
            className="lg:col-span-2"
          />
        </div>
        <button
          type="submit"
          disabled={createOrg.isPending || updateOrg.isPending}
          className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {editingOrgId ? 'Save organization' : 'Create organization'}
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Organization list</h2>
          </div>
          {orgsLoading ? (
            <p className="p-4 text-sm text-gray-500">Loading organizations...</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {orgs.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => {
                    setSelectedOrgId(org.id);
                    resetManagerForm();
                  }}
                  className={`w-full px-4 py-3 text-left ${
                    org.id === activeOrgId ? 'bg-brand-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-gray-900">{org.name}</div>
                  <div className="mt-0.5 text-xs font-mono text-gray-500">{org.slug}</div>
                </button>
              ))}
              {orgs.length === 0 && <p className="p-4 text-sm text-gray-500">No organizations.</p>}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {selectedOrg && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedOrg.name}</h2>
                  <p className="text-sm text-gray-500">{selectedOrg.address || 'No address'}</p>
                  <p className="mt-1 text-xs font-mono text-gray-400">
                    {selectedOrg.public_qr_token}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEditOrg(selectedOrg)}
                    className="rounded-md px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-50"
                  >
                    Edit org
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete organization ${selectedOrg.name}?`))
                        removeOrg.mutate(selectedOrg.id);
                    }}
                    className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete org
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedOrg && (
            <form
              onSubmit={submitManager}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  {editingManagerId ? 'Edit manager' : 'Create manager'}
                </h3>
                {editingManagerId && (
                  <button
                    type="button"
                    onClick={resetManagerForm}
                    className="text-sm text-gray-500"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <TextInput
                  label="Name"
                  value={managerForm.displayName}
                  onChange={(displayName) => setManagerForm((v) => ({ ...v, displayName }))}
                  required
                />
                <TextInput
                  label="Email"
                  type="email"
                  value={managerForm.email}
                  onChange={(email) => setManagerForm((v) => ({ ...v, email }))}
                  required
                />
                <TextInput
                  label={editingManagerId ? 'New password' : 'Password'}
                  type="password"
                  value={managerForm.password}
                  onChange={(password) => setManagerForm((v) => ({ ...v, password }))}
                  required={!editingManagerId}
                />
              </div>
              <button
                type="submit"
                disabled={createManager.isPending || updateManager.isPending}
                className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {editingManagerId ? 'Save manager' : 'Create manager'}
              </button>
            </form>
          )}

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">Managers</h3>
            </div>
            {managersLoading ? (
              <p className="p-4 text-sm text-gray-500">Loading managers...</p>
            ) : managers.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No managers in this organization.</p>
            ) : (
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {managers.map((manager) => (
                    <tr key={manager.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{manager.display_name}</div>
                        <div className="text-gray-500">{manager.email}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => startEditManager(manager)}
                          className="rounded-md px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete manager ${manager.display_name}?`))
                              removeManager.mutate(manager.id);
                          }}
                          className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                        >
                          Delete
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
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  className = '',
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}>) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <input
        value={value}
        type={type}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
    </label>
  );
}

function orgPayload(form: OrgForm, partial: boolean) {
  const payload = {
    name: form.name.trim(),
    slug: form.slug.trim(),
    publicQrToken: form.publicQrToken.trim() || undefined,
    logoUrl: form.logoUrl.trim() || null,
    phone: form.phone.trim() || null,
    address: form.address.trim() || null,
    paymentInfo: form.paymentInfo.trim() || null,
  };

  if (!partial) return payload;
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== ''));
}
