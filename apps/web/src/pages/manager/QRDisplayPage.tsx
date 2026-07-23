import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { get } from '../../services/apiClient';
import { getCustomerLineEntryUrl } from '../../services/liff/entryUrl';

interface QueueStatus {
  queue: { id: string; name: string; status: string };
  waitingCount: number;
  estimatedWaitSeconds: number | null;
}

export function QRDisplayPage() {
  const { t } = useTranslation(['manager', 'common']);
  const { id } = useParams<{ id: string }>();
  const publicJoinUrl = `${window.location.origin}/join/${id}`;
  const joinUrl = id
    ? (getCustomerLineEntryUrl(`/liff/join/${id}`) ?? publicJoinUrl)
    : publicJoinUrl;

  const { data } = useQuery<QueueStatus>({
    queryKey: ['queue-status', id],
    queryFn: () => get<QueueStatus>(`/api/v1/queue/${id}/status`),
    refetchInterval: 30_000,
    enabled: !!id,
  });

  const queueName = data?.queue.name ?? t('nav.queue', { ns: 'common' });
  const waitingCount = data?.waitingCount ?? 0;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-6 py-12 text-white">
      <div className="text-center space-y-8 max-w-lg w-full">
        <div>
          <span className="text-6xl">🟢</span>
          <h1 className="mt-4 text-4xl font-black">{queueName}</h1>
          <p className="mt-2 text-gray-400 text-lg">{t('qr.scanHint')}</p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <QRCodeSVG value={joinUrl} size={260} level="M" />
          </div>
        </div>

        {/* Live waiting count */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <p className="text-6xl font-black text-brand-400">{waitingCount}</p>
          <p className="text-gray-400 mt-2 text-lg">
            {t('units.people', { ns: 'common', count: waitingCount })}
          </p>
        </div>

        <p className="text-gray-500 text-sm break-all">{joinUrl}</p>

        <Link
          to={`/queues/${id}`}
          className="inline-block mt-4 text-gray-400 hover:text-white text-sm underline transition-colors"
        >
          ← {t('qr.backToQueue')}
        </Link>
      </div>
    </div>
  );
}
