import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import type { OrganizationSuspensionReason } from '@line-queue/shared';
import {
  API_BASE_PATH,
  ORGANIZATION_SUSPENSION_NOTE_MAX_LENGTH,
  ORGANIZATION_SUSPENSION_REASONS,
} from '@line-queue/shared';

import { get, patch, post } from '../../services/apiClient';

import type { OrgRow } from './AdminOrganizationsPage';

interface OwnerManager {
  id: string;
  display_name: string;
  email: string | null;
  account_status?: string;
  is_active: boolean;
}

const ORGANIZATION_NAME_DISPLAY_LIMIT = 40;

function truncateOrganizationName(name: string) {
  const characters = Array.from(name);
  return characters.length > ORGANIZATION_NAME_DISPLAY_LIMIT
    ? `${characters.slice(0, ORGANIZATION_NAME_DISPLAY_LIMIT).join('')}...`
    : name;
}

export function AdminOrganizationDetailPage() {
  const { t } = useTranslation(['admin', 'common', 'marketing']);
  const { orgId = '' } = useParams();
  const client = useQueryClient();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [showSuspensionForm, setShowSuspensionForm] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState<OrganizationSuspensionReason | ''>('');
  const [suspensionNote, setSuspensionNote] = useState('');

  const organizations = useQuery<OrgRow[]>({
    queryKey: ['admin-orgs'],
    queryFn: () => get(`${API_BASE_PATH}/admin/organizations`),
  });
  const org = useMemo(
    () => organizations.data?.find((item) => item.id === orgId) ?? null,
    [orgId, organizations.data]
  );
  const owners = useQuery<OwnerManager[]>({
    queryKey: ['admin-org-owner', orgId],
    queryFn: () => get(`${API_BASE_PATH}/admin/organizations/${orgId}/managers`),
    enabled: Boolean(orgId),
  });
  const owner = owners.data?.[0] ?? null;

  useEffect(() => {
    if (!owner) return;
    setEmail(owner.email ?? '');
  }, [owner]);

  const updateOwner = useMutation({
    mutationFn: () =>
      patch(`${API_BASE_PATH}/admin/organizations/${orgId}/managers/${owner?.id}`, {
        email,
      }),
    onSuccess: () => {
      setError('');
      void client.invalidateQueries({ queryKey: ['admin-org-owner', orgId] });
    },
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : t('organizations.operationFailed')),
  });

  const suspendOrganization = useMutation({
    mutationFn: () => {
      if (!suspensionReason) throw new Error(t('organizations.suspensionReasonRequired'));
      const note = suspensionNote.trim();
      return post(`${API_BASE_PATH}/admin/organizations/${orgId}/suspend`, {
        reason: suspensionReason,
        ...(note ? { note } : {}),
      });
    },
    onSuccess: () => {
      setError('');
      setShowSuspensionForm(false);
      setSuspensionReason('');
      setSuspensionNote('');
      void client.invalidateQueries({ queryKey: ['admin-orgs'] });
    },
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : t('organizations.operationFailed')),
  });

  if (organizations.isLoading || owners.isLoading) {
    return <p className="text-sm text-gray-500">{t('organizations.loading')}</p>;
  }
  if (!org) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{t('organizations.notFound')}</p>
        <Link to="/admin/orgs" className="text-sm font-bold text-brand-700">
          {t('organizations.backToList')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            {t('labels.organization', { ns: 'common' })}
          </p>
          <h1
            aria-label={org.name}
            title={org.name}
            className="mt-2 [overflow-wrap:anywhere] text-3xl font-bold text-gray-950"
          >
            {truncateOrganizationName(org.name)}
          </h1>
          <div className="mt-2">
            <OrganizationStatusBadge status={org.activation_status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">{t('organizations.adminReadOnlyHint')}</p>
        </div>
        <Link
          to="/admin/orgs"
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700"
        >
          {t('organizations.backToList')}
        </Link>
      </header>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="grid gap-5 sm:grid-cols-[96px_1fr_auto]">
          {org.logo_url ? (
            <img
              src={org.logo_url}
              alt=""
              className="aspect-square w-24 rounded-lg border border-gray-200 object-cover"
            />
          ) : (
            <div className="flex aspect-square w-24 items-center justify-center rounded-lg bg-gray-100 text-2xl font-bold text-gray-400">
              {org.name.slice(0, 1)}
            </div>
          )}
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Info label={t('organizations.slug')} value={org.slug} />
            <Info label={t('labels.phone', { ns: 'common' })} value={org.phone ?? '-'} />
            <Info label={t('labels.address', { ns: 'common' })} value={org.address ?? '-'} wide />
            <Info label={t('organizations.defaultLocale')} value={org.default_locale ?? 'ja'} />
            <Info
              label={t('organizations.status')}
              value={t(`organizations.statuses.${org.activation_status}`)}
            />
            <Info
              label={t('organizations.subscriptionPlan')}
              value={t(`pricing.${org.subscription_plan}.name`, { ns: 'marketing' })}
            />
          </dl>
          {org.activation_status === 'active' && (
            <button
              type="button"
              onClick={() => {
                setError('');
                setShowSuspensionForm(true);
              }}
              className="self-start rounded-lg px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
            >
              {t('organizations.suspendOrganization')}
            </button>
          )}
        </div>
      </section>

      {showSuspensionForm && org.activation_status === 'active' && (
        <form
          aria-labelledby="organization-suspension-title"
          onSubmit={(event) => {
            event.preventDefault();
            suspendOrganization.mutate();
          }}
          className="rounded-lg border border-red-200 bg-red-50 p-5"
        >
          <h2 id="organization-suspension-title" className="font-bold text-gray-950">
            {t('organizations.suspensionFormTitle')}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {t('organizations.suspensionFormDescription', { name: org.name })}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              {t('organizations.suspensionReason')}
              <select
                name="suspensionReason"
                required
                value={suspensionReason}
                onChange={(event) =>
                  setSuspensionReason(event.target.value as OrganizationSuspensionReason | '')
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">{t('organizations.suspensionReasonPlaceholder')}</option>
                {ORGANIZATION_SUSPENSION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {t(`organizations.suspensionReasons.${reason}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              {t('organizations.suspensionNote')}
              <textarea
                name="suspensionNote"
                maxLength={ORGANIZATION_SUSPENSION_NOTE_MAX_LENGTH}
                value={suspensionNote}
                onChange={(event) => setSuspensionNote(event.target.value)}
                placeholder={t('organizations.suspensionNotePlaceholder')}
                rows={4}
                className="mt-1 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!suspensionReason || suspendOrganization.isPending}
              className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {t('organizations.confirmSuspension')}
            </button>
            <button
              type="button"
              disabled={suspendOrganization.isPending}
              onClick={() => {
                setShowSuspensionForm(false);
                setSuspensionReason('');
                setSuspensionNote('');
              }}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 disabled:opacity-50"
            >
              {t('organizations.cancelSuspension')}
            </button>
          </div>
        </form>
      )}

      {org.activation_status === 'suspended' && org.suspension_reason && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-bold text-gray-950">{t('organizations.suspensionDetails')}</h2>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <Info
              label={t('organizations.suspensionReason')}
              value={t(`organizations.suspensionReasons.${org.suspension_reason}`)}
            />
            <Info
              label={t('organizations.suspensionNote')}
              value={org.suspension_note || t('organizations.suspensionNoteEmpty')}
            />
          </dl>
        </section>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          updateOwner.mutate();
        }}
        className="rounded-lg border border-gray-200 bg-white p-5"
      >
        <h2 className="font-bold text-gray-950">{t('organizations.ownerAccount')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('organizations.ownerRepairHint')}</p>
        {owner ? (
          <>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-gray-50 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500">
                  {t('labels.displayName', { ns: 'common' })}
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-950">{owner.display_name}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {t('organizations.ownerNameReadOnly')}
                </p>
              </div>
              <Field
                label={t('labels.email', { ns: 'common' })}
                value={email}
                onChange={setEmail}
                type="email"
                placeholder="owner@example.jp"
              />
            </div>
            <button
              type="submit"
              disabled={updateOwner.isPending}
              className="mt-4 rounded-lg bg-gray-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {t('organizations.saveOwnerEmail')}
            </button>
          </>
        ) : (
          <p className="mt-4 text-sm text-amber-700">{t('organizations.ownerMissing')}</p>
        )}
      </form>
    </div>
  );
}

function OrganizationStatusBadge({ status }: Readonly<{ status: OrgRow['activation_status'] }>) {
  const { t } = useTranslation('admin');
  const color =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'suspended'
        ? 'bg-red-50 text-red-700'
        : 'bg-amber-50 text-amber-700';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>
      {t(`organizations.statuses.${status}`)}
    </span>
  );
}

function Info({
  label,
  value,
  wide = false,
}: Readonly<{ label: string; value: string; wide?: boolean }>) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-semibold text-gray-500">{label}</dt>
      <dd className="mt-1 break-words font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}>) {
  return (
    <label className="text-sm font-medium text-gray-700">
      {label}
      <input
        name={type === 'email' ? 'email' : undefined}
        type={type}
        maxLength={type === 'email' ? 254 : 200}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
      />
    </label>
  );
}
