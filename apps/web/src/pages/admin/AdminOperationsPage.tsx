import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, RefreshCw, Server } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { API_BASE_PATH } from '@line-queue/shared';

import { get } from '../../services/apiClient';

type Status = 'healthy' | 'degraded' | 'unavailable' | 'not_configured' | 'not_applicable';

interface ComponentHealth {
  status: Status;
  reasonCode?: string;
  lastHeartbeatAt?: string;
  mode?: string;
  provider?: string;
  activeConnections?: number;
}

interface OperationalSnapshot {
  status: Status;
  checkedAt: string;
  environment: string;
  release: string;
  uptimeSeconds: number;
  components: Record<string, ComponentHealth>;
  notifications: ComponentHealth & {
    pending: number;
    retrying: number;
    failed: number;
    oldestPendingSeconds: number;
  };
  indicators: {
    requestCount: number;
    errorCount: number;
    requestErrorRate: number;
    requestLatencySeconds: number;
    notificationDeliveryLatencySeconds: number;
    postgresPool: { total: number; idle: number; waiting: number };
  };
}

const COMPONENT_ORDER = ['api', 'postgres', 'redis', 'worker', 'realtime', 'line', 'payment'];

export function AdminOperationsPage() {
  const { t, i18n } = useTranslation('admin');
  const health = useQuery<OperationalSnapshot>({
    queryKey: ['admin-operational-health'],
    queryFn: () => get(`${API_BASE_PATH}/admin/operations/health`),
    refetchInterval: 30_000,
  });

  if (health.isLoading) {
    return <p className="text-sm text-gray-500">{t('operations.loading')}</p>;
  }
  if (health.isError || !health.data) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-5" role="alert">
        <h1 className="font-bold text-red-900">{t('operations.loadFailed')}</h1>
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm font-bold text-red-800"
          onClick={() => void health.refetch()}
        >
          <RefreshCw size={16} /> {t('operations.retry')}
        </button>
      </section>
    );
  }

  const data = health.data;
  const formatter = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'ja', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-brand-700">{t('operations.section')}</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950">{t('operations.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('operations.description')}</p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-bold text-gray-700"
          onClick={() => void health.refetch()}
        >
          <RefreshCw size={16} /> {t('operations.refresh')}
        </button>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <StatusIcon status={data.status} />
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">{t('operations.overall')}</p>
              <p className="text-xl font-bold text-gray-950">
                {t(`operations.status.${data.status}`)}
              </p>
            </div>
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <Meta label={t('operations.environment')} value={data.environment} />
            <Meta label={t('operations.release')} value={data.release} />
            <Meta
              label={t('operations.checkedAt')}
              value={formatter.format(new Date(data.checkedAt))}
            />
          </dl>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 text-blue-700" size={20} />
            <div>
              <h2 className="font-bold text-blue-950">{t('operations.guidanceTitle')}</h2>
              <p className="mt-1 text-sm leading-6 text-blue-900">{t('operations.guidance')}</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-950">{t('operations.components')}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {COMPONENT_ORDER.map((name) => {
            const component = data.components[name];
            if (!component) return null;
            return (
              <article
                key={name}
                className="min-w-0 rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Server size={17} className="shrink-0 text-gray-500" />
                    <h3 className="truncate font-bold text-gray-900">
                      {t(`operations.component.${name}`)}
                    </h3>
                  </div>
                  <StatusBadge
                    status={component.status}
                    label={t(`operations.status.${component.status}`)}
                  />
                </div>
                {component.reasonCode && (
                  <p className="mt-3 text-xs leading-5 text-gray-500">
                    {t(`operations.reason.${component.reasonCode}`)}
                  </p>
                )}
                {component.mode && (
                  <p className="mt-3 text-xs font-semibold text-gray-600">
                    {component.mode} / {component.provider}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="font-bold text-gray-950">{t('operations.notifications')}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Meta label={t('operations.pending')} value={String(data.notifications.pending)} />
            <Meta label={t('operations.retrying')} value={String(data.notifications.retrying)} />
            <Meta label={t('operations.failed')} value={String(data.notifications.failed)} />
            <Meta
              label={t('operations.oldestPending')}
              value={t('operations.seconds', {
                count: Math.round(data.notifications.oldestPendingSeconds),
              })}
            />
          </dl>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="font-bold text-gray-950">{t('operations.indicators')}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Meta label={t('operations.requests')} value={String(data.indicators.requestCount)} />
            <Meta label={t('operations.errors')} value={String(data.indicators.errorCount)} />
            <Meta
              label={t('operations.errorRate')}
              value={new Intl.NumberFormat(i18n.resolvedLanguage ?? 'ja', {
                style: 'percent',
                maximumFractionDigits: 1,
              }).format(data.indicators.requestErrorRate)}
            />
            <Meta
              label={t('operations.latency')}
              value={t('operations.seconds', { count: data.indicators.requestLatencySeconds })}
            />
          </dl>
        </div>
      </section>
    </div>
  );
}

function StatusIcon({ status }: Readonly<{ status: Status }>) {
  return status === 'healthy' ? (
    <CheckCircle2 className="text-emerald-600" size={30} />
  ) : (
    <AlertTriangle className="text-amber-600" size={30} />
  );
}

function StatusBadge({ status, label }: Readonly<{ status: Status; label: string }>) {
  const colors =
    status === 'healthy'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'degraded'
        ? 'bg-amber-100 text-amber-900'
        : status === 'unavailable'
          ? 'bg-red-100 text-red-800'
          : 'bg-gray-100 text-gray-700';
  return (
    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${colors}`}>
      {label}
    </span>
  );
}

function Meta({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-bold text-gray-900">{value}</dd>
    </div>
  );
}
