import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import type { Queue } from '@line-queue/shared';

import { Spinner } from '../../components/ui/Spinner';
import { useQueue } from '../../hooks/useQueues';
import { queuesApi } from '../../services/queues.api';

export function QueueSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: queue, isLoading } = useQueue(id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'open',
    maxCapacity: '',
    avgServiceTimeMinutes: '',
  });

  useEffect(() => {
    if (queue) {
      setForm({
        name: queue.name,
        description: queue.description ?? '',
        status: queue.status,
        maxCapacity:
          queue.maxCapacity !== null && queue.maxCapacity !== undefined
            ? String(queue.maxCapacity)
            : '',
        avgServiceTimeMinutes:
          queue.avgServiceTimeMinutes !== null && queue.avgServiceTimeMinutes !== undefined
            ? String(queue.avgServiceTimeMinutes)
            : '',
      });
    }
  }, [queue]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError('');
    setSaving(true);
    try {
      await queuesApi.update(id, {
        name: form.name,
        description: form.description || undefined,
        status: form.status as Queue['status'],
        maxCapacity: form.maxCapacity ? parseInt(form.maxCapacity) : undefined,
        avgServiceTimeMinutes: form.avgServiceTimeMinutes
          ? parseInt(form.avgServiceTimeMinutes)
          : undefined,
      });
      setSaved(true);
      setTimeout(() => navigate(`/queues/${id}`), 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi khi lưu cài đặt.');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/queues/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Chi tiết
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">Cài đặt hàng đợi</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5"
      >
        <Field label="Tên hàng đợi *">
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Mô tả">
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Trạng thái">
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className={inputCls}
          >
            <option value="open">Mở</option>
            <option value="paused">Tạm dừng</option>
            <option value="closed">Đóng</option>
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Sức chứa tối đa">
            <input
              type="number"
              min="1"
              placeholder="Không giới hạn"
              value={form.maxCapacity}
              onChange={(e) => set('maxCapacity', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Thời gian phục vụ TB (phút)">
            <input
              type="number"
              min="1"
              placeholder="VD: 15"
              value={form.avgServiceTimeMinutes}
              onChange={(e) => set('avgServiceTimeMinutes', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {saved && <p className="text-green-600 text-sm">✓ Đã lưu. Đang chuyển hướng...</p>}

        <div className="flex gap-3 pt-2">
          <Link
            to={`/queues/${id}`}
            className="flex-1 text-center border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Huỷ
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
