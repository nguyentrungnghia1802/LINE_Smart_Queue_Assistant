import { EmptyState } from '../../components/ui/EmptyState';

/**
 * History page — placeholder for completed / cancelled queue entries.
 *
 * URL: /liff/history
 *
 * This is a scaffolded placeholder for Prompt 15+.
 * The history endpoint (GET /api/v1/queue/history) and pagination
 * will be wired up in a future iteration.
 */
export function HistoryPage() {
  return (
    <div className="max-w-md mx-auto">
      <EmptyState
        icon="📜"
        title="履歴はまだありません"
        message="完了またはキャンセル済みの受付がここに表示されます。"
      />
    </div>
  );
}
