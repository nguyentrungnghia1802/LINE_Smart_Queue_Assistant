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
import type { QueueEntryDisplay } from '../types';

// ── Sub-components ────────────────────────────────────────────────────────────

function EntryCard({ entry, actions }: { entry: QueueEntryDisplay; actions: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-xl font-bold text-gray-900">{entry.ticket_display}</p>
        <p className="text-xs text-gray-500 mt-0.5 capitalize">{entry.status}</p>
        {entry.notes && <p className="text-sm text-gray-600 mt-1">{entry.notes}</p>}
      </div>
      <div className="flex gap-2 flex-shrink-0">{actions}</div>
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

// ── Page ──────────────────────────────────────────────────────────────────────

export function StaffQueuePage() {
  const { queueId = '' } = useParams<{ queueId: string }>();

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
        <p className="text-gray-500 mb-4">Failed to load queue data.</p>
        <Link to="/queues" className="text-brand-600 hover:underline text-sm">
          ← Back to queues
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
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link to="/queues" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Queues
        </Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{overview.queueName} — Staff Board</h1>
        <span className="text-sm text-gray-500">{overview.waitingCount} waiting</span>
      </div>

      {/* Serving entry */}
      {overview.servingEntry && (
        <section className="mb-6">
          {/* servingEntry is non-null inside this block */}
          {(({ id, ...rest }) => (
            <>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Serving Now
              </h2>
              <EntryCard
                entry={{ id, ...rest }}
                actions={
                  <ActionBtn
                    label="Complete"
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
          {/* calledEntry is non-null inside this block */}
          {(({ id, ...rest }) => (
            <>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Called
              </h2>
              <EntryCard
                entry={{ id, ...rest }}
                actions={
                  <>
                    <ActionBtn
                      label="Serve"
                      variant="primary"
                      disabled={isBusy}
                      onClick={() => serve.mutate(id)}
                    />
                    <ActionBtn
                      label="No-show"
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
            Call Next Ticket
          </button>
        </div>
      )}

      {/* Waiting list */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Waiting ({overview.waitingCount})
        </h2>
        {overview.waitingEntries.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">No waiting entries.</p>
        ) : (
          <div className="space-y-3">
            {overview.waitingEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                actions={
                  <ActionBtn
                    label="Cancel"
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
  );
}
