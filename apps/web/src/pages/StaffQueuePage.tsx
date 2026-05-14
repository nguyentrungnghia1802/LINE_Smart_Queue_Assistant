import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Spinner } from '../components/ui/Spinner';
import {
  useCallNext,
  useCancelEntry,
  useCompleteEntry,
  useNoShowEntry,
  useServeEntry,
  useStaffQueueOverview,
} from '../hooks/useStaffQueue';
import { post } from '../services/apiClient';
import type { QueueEntryDisplay } from '../types';

// ── Sub-components ────────────────────────────────────────────────────────────

function EntryCard({ entry, actions }: { entry: QueueEntryDisplay; actions: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xl font-bold text-gray-900">{entry.ticket_display}</p>
        <p className="text-xs text-gray-500 mt-0.5 capitalize">{entry.status}</p>
        {entry.notes && <p className="text-sm text-gray-600 mt-1">{entry.notes}</p>}
      </div>
      <div className="flex gap-2 flex-shrink-0 flex-wrap">{actions}</div>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  variant = 'secondary',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const base = 'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50';
  const styles = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
    danger: 'bg-red-100 hover:bg-red-200 text-red-700',
  };

  return (
    <button className={`${base} ${styles[variant]}`} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

// ── Walk-in modal ─────────────────────────────────────────────────────────────

function WalkInModal({ queueId, onClose }: { queueId: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const qc = useQueryClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await post('/api/v1/queue/join', { queueId, guestName: name });
      qc.invalidateQueries({ queryKey: ['staff-queue', queueId] });
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Lỗi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Thêm khách walk-in</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên khách</label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Nguyễn Văn A"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm"
            >
              {saving ? 'Đang thêm...' : 'Thêm vào hàng đợi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function StaffQueuePage() {
  const { queueId = '' } = useParams<{ queueId: string }>();
  const [showWalkIn, setShowWalkIn] = useState(false);

  const { data: overview, isLoading, isError } = useStaffQueueOverview(queueId);

  const callNext = useCallNext(queueId);
  const serve = useServeEntry(queueId);
  const complete = useCompleteEntry(queueId);
  const noShow = useNoShowEntry(queueId);
  const cancel = useCancelEntry(queueId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (isError || !overview) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Không tải được dữ liệu hàng đợi.</p>
        <Link to="/queues" className="text-brand-600 hover:underline text-sm">
          ← Quay lại
        </Link>
      </div>
    );
  }

  const isBusy =
    callNext.isPending ||
    serve.isPending ||
    complete.isPending ||
    noShow.isPending ||
    cancel.isPending;

  return (
    <>
      {showWalkIn && <WalkInModal queueId={queueId} onClose={() => setShowWalkIn(false)} />}

      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Link to="/queues" className="text-gray-400 hover:text-gray-600 text-sm">
            ← Hàng đợi
          </Link>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{overview.queueName}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{overview.waitingCount} người đang chờ</p>
          </div>
          <div className="flex gap-2">
            <Link
              to={`/queues/${queueId}/display`}
              className="inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              📺 QR
            </Link>
            <button
              onClick={() => setShowWalkIn(true)}
              className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              ➕ Walk-in
            </button>
          </div>
        </div>

        {/* Serving entry */}
        {overview.servingEntry && (
          <section className="mb-6">
            {(({ id, ...rest }) => (
              <>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Đang phục vụ
                </h2>
                <EntryCard
                  entry={{ id, ...rest }}
                  actions={
                    <ActionBtn
                      label="Hoàn thành"
                      variant="primary"
                      disabled={isBusy}
                      onClick={() => complete.mutate(id)}
                    />
                  }
                />
              </>
            ))(overview.servingEntry)}
          </section>
        )}

        {/* Called entry */}
        {overview.calledEntry && (
          <section className="mb-6">
            {(({ id, ...rest }) => (
              <>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Đã gọi
                </h2>
                <EntryCard
                  entry={{ id, ...rest }}
                  actions={
                    <>
                      <ActionBtn
                        label="Phục vụ"
                        variant="primary"
                        disabled={isBusy}
                        onClick={() => serve.mutate(id)}
                      />
                      <ActionBtn
                        label="Vắng mặt"
                        variant="danger"
                        disabled={isBusy}
                        onClick={() => noShow.mutate(id)}
                      />
                    </>
                  }
                />
              </>
            ))(overview.calledEntry)}
          </section>
        )}

        {/* Call next button */}
        {!overview.calledEntry && overview.waitingCount > 0 && (
          <div className="mb-6">
            <button
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
              disabled={isBusy}
              onClick={() => callNext.mutate()}
            >
              Gọi số tiếp theo
            </button>
          </div>
        )}

        {/* Waiting list */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Đang chờ ({overview.waitingCount})
          </h2>
          {overview.waitingEntries.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">Không có ai đang chờ.</p>
          ) : (
            <div className="space-y-3">
              {overview.waitingEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  actions={
                    <ActionBtn
                      label="Huỷ"
                      variant="danger"
                      disabled={isBusy}
                      onClick={() => cancel.mutate(entry.id)}
                    />
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
